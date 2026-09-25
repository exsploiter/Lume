import type {
  ASTSymbol,
  ParsedFile,
  SecurityAnalysisResult,
  SecurityFinding,
  SecurityNodeMetrics,
  SecuritySummary,
  VulnerabilitySeverity,
} from '@/types';
import {
  clampScore,
  countOccurrences,
  highestSeverity,
  isProductionPath,
  isSecuritySensitivePath,
  isTestLikePath,
  lineAt,
  locateLineRange,
  makeFindingId,
  severityRank,
  unique,
} from '@/lib/security/security-utils';
import { calculateSecurityScore, calculateSecurityWeightedScore } from '@/lib/security/security-scorer';
import { mapOWASPIds } from '@/lib/security/owasp-mapper';
import { mapCWEIds } from '@/lib/security/cwe-mapper';
import { analyzeSecurityCollapse } from '@/lib/security/security-collapse';

type RuleContext = {
  file: ParsedFile;
  lineNumber: number;
  line: string;
  content: string;
};

type SecurityRule = {
  id: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  category: string;
  owaspIds: string[];
  cweIds: string[];
  recommendation: string;
  exploitability: number;
  match: (context: RuleContext) => boolean;
  suppress?: (context: RuleContext) => boolean;
  evidence?: (context: RuleContext) => string;
};

const RULES: SecurityRule[] = [
  {
    id: 'hardcoded-secret',
    title: 'Hardcoded secret or credential',
    description: 'Sensitive secrets, tokens, keys, or credentials appear directly in source.',
    severity: 'critical',
    category: 'Secrets',
    owaspIds: ['A05', 'A07'],
    cweIds: ['CWE_798', 'CWE_259', 'CWE_321'],
    recommendation: 'Move secrets to environment variables or a managed secret store and rotate exposed values.',
    exploitability: 0.95,
    match: ({ line }) => /(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line) || /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(line),
    suppress: ({ file }) => isTestLikePath(file.path),
  },
  {
    id: 'sql-injection',
    title: 'SQL injection sink',
    description: 'User-controlled data flows into SQL construction or execution.',
    severity: 'critical',
    category: 'Injection',
    owaspIds: ['A03'],
    cweIds: ['CWE_89', 'CWE_564'],
    recommendation: 'Use parameterized queries or prepared statements and validate all query inputs.',
    exploitability: 0.9,
    match: ({ line }) => /(select|insert|update|delete|query|execute|exec)\s*\([^)]*(?:\+|`\$\{|format\(|join\().*/i.test(line) || /from\s*\(.*req\.|body\.|params\.|query\./i.test(line),
  },
  {
    id: 'command-injection',
    title: 'Command injection sink',
    description: 'Shell execution is built from untrusted input.',
    severity: 'critical',
    category: 'Injection',
    owaspIds: ['A03'],
    cweIds: ['CWE_78'],
    recommendation: 'Avoid shell execution with user input. Use argument arrays and strict allowlists.',
    exploitability: 0.92,
    match: ({ line }) => /(exec|execSync|spawn|spawnSync|system|popen)\s*\([^)]*(?:\+|`\$\{|req\.|body\.|query\.|params\.)/i.test(line),
  },
  {
    id: 'eval-usage',
    title: 'Dynamic code evaluation',
    description: 'Unsafe dynamic evaluation expands the attack surface.',
    severity: 'high',
    category: 'Injection',
    owaspIds: ['A03'],
    cweIds: ['CWE_94', 'CWE_95'],
    recommendation: 'Remove eval-style execution and replace it with explicit parsing or dispatch logic.',
    exploitability: 0.85,
    match: ({ line }) => /\beval\s*\(|new Function\s*\(|setTimeout\s*\(\s*['"`].*['"`]/i.test(line),
  },
  {
    id: 'xss',
    title: 'Cross-site scripting sink',
    description: 'Unsafe HTML insertion or scripting may execute attacker-controlled markup.',
    severity: 'high',
    category: 'XSS',
    owaspIds: ['A03', 'A05'],
    cweIds: ['CWE_79', 'CWE_116'],
    recommendation: 'Escape output, avoid raw HTML insertion, and sanitize any rich content.',
    exploitability: 0.82,
    match: ({ line }) => /dangerouslySetInnerHTML|innerHTML\s*=|outerHTML\s*=|document\.write\s*\(/i.test(line),
  },
  {
    id: 'jwt-weakness',
    title: 'JWT validation weakness',
    description: 'Token decoding, weak verification, or insecure JWT configuration was detected.',
    severity: 'high',
    category: 'Auth',
    owaspIds: ['A07'],
    cweIds: ['CWE_347', 'CWE_287'],
    recommendation: 'Verify JWT signatures, pin algorithms, and reject unsigned or weakly configured tokens.',
    exploitability: 0.8,
    match: ({ line }) => /jwt\.(decode|verify|sign)|alg\s*:\s*['"]none['"]|ignoreExpiration\s*:\s*true/i.test(line),
  },
  {
    id: 'weak-crypto',
    title: 'Weak cryptography or hashing',
    description: 'Deprecated or weak cryptographic primitives are used.',
    severity: 'medium',
    category: 'Crypto',
    owaspIds: ['A02'],
    cweIds: ['CWE_327', 'CWE_328', 'CWE_330'],
    recommendation: 'Replace weak algorithms with modern, approved cryptography and strong randomness sources.',
    exploitability: 0.6,
    match: ({ line }) => /\b(md5|sha1|des|rc4|rabbit|bcrypt\s*\(.*?\brounds\s*[:=]\s*[0-3]\b|crypto\.createHash\s*\(\s*['"](?:md5|sha1)['"])/i.test(line),
  },
  {
    id: 'insecure-deserialization',
    title: 'Insecure deserialization',
    description: 'Trusted data is deserialized without safety controls.',
    severity: 'high',
    category: 'Integrity',
    owaspIds: ['A08'],
    cweIds: ['CWE_502', 'CWE_94A', 'CWE_611'],
    recommendation: 'Avoid unsafe deserializers, validate schemas, and keep untrusted data as plain data.',
    exploitability: 0.78,
    match: ({ line }) => /(?:deserialize|unserialize|yaml\.load|jsyaml\.load|pickle|Marshal\.load|Object\.assign\s*\(.*req\.|JSON\.parse\s*\(.*req\.)/i.test(line),
  },
  {
    id: 'ssrf',
    title: 'Server-side request forgery',
    description: 'User-controlled URLs can pivot server requests into internal services.',
    severity: 'critical',
    category: 'SSRF',
    owaspIds: ['A10'],
    cweIds: ['CWE_918'],
    recommendation: 'Allowlist destinations, validate URLs, and block internal network ranges.',
    exploitability: 0.9,
    match: ({ line }) => /(?:fetch|axios\.|request|http\.request|https\.request)\s*\(.*(?:req\.|query\.|body\.|params\.|url|href)/i.test(line),
  },
  {
    id: 'path-traversal',
    title: 'Path traversal sink',
    description: 'File paths are built from user-controlled input without normalization.',
    severity: 'high',
    category: 'Path',
    owaspIds: ['A05'],
    cweIds: ['CWE_22'],
    recommendation: 'Normalize and constrain paths to a strict base directory before file access.',
    exploitability: 0.82,
    match: ({ line }) => /(?:readFile|readFileSync|createReadStream|stat|unlink|writeFile|writeFileSync|resolve|join)\s*\(.*(?:req\.|query\.|params\.|body\.)/i.test(line),
  },
  {
    id: 'prototype-pollution',
    title: 'Prototype pollution risk',
    description: 'Object merging or key handling can mutate prototypes or unsafe paths.',
    severity: 'high',
    category: 'Integrity',
    owaspIds: ['A08'],
    cweIds: ['CWE_1321', 'CWE_915'],
    recommendation: 'Reject prototype keys and avoid merging untrusted objects directly into application state.',
    exploitability: 0.75,
    match: ({ line }) => /__proto__|constructor\.prototype|Object\.assign\s*\(|deepmerge\s*\(|merge\s*\(/i.test(line),
  },
  {
    id: 'mass-assignment',
    title: 'Mass assignment',
    description: 'Untrusted request bodies are written directly into models or persistence layers.',
    severity: 'high',
    category: 'Auth',
    owaspIds: ['A01'],
    cweIds: ['CWE_915'],
    recommendation: 'Whitelist assignable fields and map request DTOs explicitly.',
    exploitability: 0.72,
    match: ({ line }) => /(?:create|update|save|patch)\s*\(.*(?:req\.|body\.|query\.|params\.|\.body\b|\.json\b)/i.test(line) || /Object\.assign\s*\(.*(?:model|user|data).*,\s*(?:req\.|body\.)/i.test(line),
  },
  {
    id: 'insecure-logging',
    title: 'Insecure logging of sensitive data',
    description: 'Logs may expose credentials, tokens, or full request payloads.',
    severity: 'medium',
    category: 'Logging',
    owaspIds: ['A09'],
    cweIds: ['CWE_532', 'CWE_200'],
    recommendation: 'Redact sensitive fields before logging and avoid logging secrets or entire payloads.',
    exploitability: 0.58,
    match: ({ line }) => /console\.(log|warn|error)|logger\.(info|warn|error)|debug\(/i.test(line),
    evidence: ({ line }) => line,
  },
  {
    id: 'tls-disablement',
    title: 'TLS verification disabled',
    description: 'Transport security checks are disabled or bypassed.',
    severity: 'critical',
    category: 'Transport',
    owaspIds: ['A02', 'A05'],
    cweIds: ['CWE_319', 'CWE_295'],
    recommendation: 'Never disable certificate verification in production and enforce secure transport settings.',
    exploitability: 0.93,
    match: ({ line }) => /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|secureProtocol\s*:\s*['"]?TLSv1/i.test(line),
  },
  {
    id: 'cors-wildcard',
    title: 'Overly permissive CORS',
    description: 'CORS is configured to accept any origin.',
    severity: 'medium',
    category: 'CORS',
    owaspIds: ['A05'],
    cweIds: ['CWE_346'],
    recommendation: 'Restrict CORS to trusted origins and avoid wildcard access in authenticated contexts.',
    exploitability: 0.55,
    match: ({ line }) => /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]|cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]/i.test(line),
  },
];

function shouldSuppressFinding(rule: SecurityRule, context: RuleContext): boolean {
  if (rule.suppress?.(context)) return true;
  if (isTestLikePath(context.file.path) && rule.severity !== 'critical') return true;
  if (!isProductionPath(context.file.path) && rule.category === 'Secrets') return false;
  if (/\/vendor\//i.test(context.file.path)) return true;
  return false;
}

function buildFinding(rule: SecurityRule, context: RuleContext, occurrenceCount: number): SecurityFinding {
  const location = locateLineRange(context.content, context.line.trim());
  const evidence = rule.evidence?.(context) ?? context.line.trim();
  return {
    id: makeFindingId(rule.id, context.file.path, location.start, evidence),
    ruleId: rule.id,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    filePath: context.file.path,
    lineStart: location.start,
    lineEnd: location.end,
    evidence,
    recommendation: rule.recommendation,
    occurrenceCount,
    exploitability: rule.exploitability,
    owaspIds: rule.owaspIds,
    cweIds: rule.cweIds,
    category: rule.category,
  };
}

export function detectSecurityFindings(file: ParsedFile): SecurityFinding[] {
  const lines = file.content.split(/\r?\n/);
  const findings: SecurityFinding[] = [];

  for (const rule of RULES) {
    const matchedLines: number[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const context: RuleContext = { file, lineNumber: index + 1, line, content: file.content };
      if (!rule.match(context)) continue;
      if (shouldSuppressFinding(rule, context)) continue;
      matchedLines.push(index + 1);
    }

    if (matchedLines.length === 0) continue;
    const firstLine = matchedLines[0];
    const context: RuleContext = {
      file,
      lineNumber: firstLine,
      line: lineAt(file.content, firstLine),
      content: file.content,
    };
    findings.push(buildFinding(rule, context, matchedLines.length));
  }

  const lowerContent = file.content.toLowerCase();
  if (isSecuritySensitivePath(file.path) && /password|secret|token/.test(lowerContent) && !isTestLikePath(file.path)) {
    findings.push({
      id: makeFindingId('sensitive-path-secrets', file.path, 1, file.path),
      ruleId: 'sensitive-path-secrets',
      title: 'Sensitive path secret exposure',
      description: 'A security-sensitive path contains secret-bearing code or configuration.',
      severity: 'critical',
      filePath: file.path,
      lineStart: 1,
      lineEnd: Math.min(lines.length, 1),
      evidence: file.path,
      recommendation: 'Move secrets out of the repo and isolate security-sensitive code paths.',
      occurrenceCount: 1,
      exploitability: 0.88,
      owaspIds: ['A05', 'A07'],
      cweIds: ['CWE_798', 'CWE_200'],
      category: 'Secrets',
    });
  }

  return findings;
}

export function summarizeSecurityFindings(findings: SecurityFinding[]): SecuritySummary {
  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += finding.occurrenceCount;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<VulnerabilitySeverity, number>
  );

  const score = calculateSecurityScore(counts);
  const categoryCounts: Record<string, number> = {};
  const owaspIds = unique(findings.flatMap((finding) => finding.owaspIds));
  const cweIds = unique(findings.flatMap((finding) => finding.cweIds));

  for (const finding of findings) {
    categoryCounts[finding.category] = (categoryCounts[finding.category] ?? 0) + finding.occurrenceCount;
  }

  const topFindings = [...findings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.occurrenceCount - a.occurrenceCount)
    .slice(0, 10);

  return {
    totalVulnerabilities: findings.reduce((sum, finding) => sum + finding.occurrenceCount, 0),
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    score,
    categoryCounts,
    owaspCategories: owaspIds,
    cweCategories: cweIds,
    topFindings,
  };
}

function buildNodeMetrics(
  findings: SecurityFinding[],
  symbols: ASTSymbol[],
  blastRadiusMap: Map<string, number>
): Record<string, SecurityNodeMetrics> {
  const metrics: Record<string, SecurityNodeMetrics> = {};

  for (const symbol of symbols) {
    const symbolFindings = findings.filter((finding) => finding.filePath === symbol.filePath);
    const criticalCount = symbolFindings.filter((finding) => finding.severity === 'critical').length;
    const summary = summarizeSecurityFindings(symbolFindings);
    const securityScore = summary.score;
    const blastRadius = blastRadiusMap.get(symbol.id) ?? symbol.calledBy.length;
    const weighted = calculateSecurityWeightedScore({
      securityScore,
      blastRadius,
      vulnerabilityCount: summary.totalVulnerabilities,
      criticalCount,
      hasSensitivePath: isSecuritySensitivePath(symbol.filePath),
    });

    metrics[symbol.filePath] = {
      securityScore,
      securityWeightedScore: weighted,
      hasCriticalSecurity: criticalCount > 0,
      vulnerabilityCount: summary.totalVulnerabilities,
      securityRiskLevel: highestSeverity(symbolFindings),
      owaspCategories: summary.owaspCategories,
      cweCategories: summary.cweCategories,
      securityFindings: symbolFindings,
      criticalCount,
    };
  }

  return metrics;
}

export function analyzeSecurityRepository(params: {
  files: ParsedFile[];
  symbols: ASTSymbol[];
  blastRadiusMap: Map<string, number>;
}): SecurityAnalysisResult {
  const findings = params.files.flatMap((file) => detectSecurityFindings(file));
  const summary = summarizeSecurityFindings(findings);
  const nodeMetrics = buildNodeMetrics(findings, params.symbols, params.blastRadiusMap);
  const repoSecurityScore = clampScore(
    summary.score + Math.min(20, summary.critical * 6 + summary.high * 3 + Object.keys(summary.categoryCounts).length * 2),
    0,
    100
  );

  const collapseInput: SecurityAnalysisResult = {
    findings,
    summary,
    collapse: {
      isCollapsed: false,
      severity: 'moderate',
      reasons: [],
      affectedCoreModules: [],
      propagationRisk: 0,
    },
    nodeMetrics,
    repoSecurityScore,
    criticalVulnerabilities: summary.critical,
  };

  const collapse = analyzeSecurityCollapse({
    security: collapseInput,
    symbols: params.symbols,
    blastRadiusMap: params.blastRadiusMap,
  });

  return {
    findings,
    summary,
    collapse,
    nodeMetrics,
    repoSecurityScore,
    criticalVulnerabilities: summary.critical,
  };
}

export function getSecurityNodeMetrics(
  result: SecurityAnalysisResult,
  filePath: string
): SecurityNodeMetrics {
  return result.nodeMetrics[filePath] ?? {
    securityScore: 0,
    securityWeightedScore: 0,
    hasCriticalSecurity: false,
    vulnerabilityCount: 0,
    securityRiskLevel: 'none',
    owaspCategories: [],
    cweCategories: [],
    securityFindings: [],
    criticalCount: 0,
  };
}

export function buildSecuritySummary(result: SecurityAnalysisResult): SecuritySummary {
  return result.summary;
}

export function securityFindingCounts(findings: SecurityFinding[]): Record<VulnerabilitySeverity, number> {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += finding.occurrenceCount;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<VulnerabilitySeverity, number>
  );
}

export function securityCategoryList(findings: SecurityFinding[]): string[] {
  return unique(findings.map((finding) => finding.category));
}
