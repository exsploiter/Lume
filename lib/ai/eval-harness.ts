import { generateDebtExplanation } from '@/lib/huggingface';
import { PromptContext } from './prompt-registry';
import { getExplanationCacheStats } from './explanation-cache';

export interface EvalMetricResult {
  snippetName: string;
  durationMs: number;
  schemaValid: boolean;
  bannedJargonCount: number;
  foundBannedWords: string[];
  technicalTermCount: number;
  actionabilityScore: number;
  explanationPreview: string;
  grade: 'PASS' | 'WARN' | 'FAIL';
}

export interface EvalReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  averageLatencyMs: number;
  bannedJargonViolations: number;
  averageActionabilityScore: number;
  cacheStats: ReturnType<typeof getExplanationCacheStats>;
  results: EvalMetricResult[];
}

const BANNED_BUSINESS_WORDS = [
  'roi',
  'monetization',
  'quarterly',
  'revenue',
  'customer sentiment',
  'synergy',
  'stakeholders',
  'shareholders',
  'market share',
  'business impact',
  'executive summary',
  'bottom line',
  'kpi',
  'okr',
];

const TECHNICAL_TERMS = [
  'complexity',
  'coupling',
  'blast radius',
  'cyclomatic',
  'injection',
  'sanitization',
  'parameterized',
  'asynchronous',
  'race condition',
  'memory leak',
  'closure',
  'scope',
  'refactor',
  'pointer',
  'overflow',
  'deadlock',
  'recursion',
  'propagation',
  'vulnerability',
  'cwe',
  'owasp',
];

export const SYNTHETIC_EVAL_BENCHMARKS: Array<{ name: string; context: PromptContext }> = [
  {
    name: 'SQL Injection in Express Handler',
    context: {
      filePath: 'src/routes/users.ts',
      symbolName: 'getUserByInput',
      debtScore: 92,
      complexity: 12,
      blastRadius: 8,
      codeSnippet: `export async function getUserByInput(req, res) {
  const query = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
  const result = await db.query(query);
  return res.json(result);
}`,
      securityScore: 95,
      vulnerabilityCount: 1,
      securityRiskLevel: 'critical',
      owaspCategories: ['A03:2021-Injection'],
      cweCategories: ['CWE-89'],
      securityFindings: [
        {
          title: 'Direct SQL query concatenation with unvalidated user input',
          severity: 'critical',
          recommendation: 'Use parameterized queries or ORM abstractions.',
          evidence: `db.query("SELECT * FROM users WHERE name = '" + req.query.name + "')`,
        },
      ],
    },
  },
  {
    name: 'High Cyclomatic God-Object Handler',
    context: {
      filePath: 'src/services/billing-calculator.ts',
      symbolName: 'calculateTaxAndDiscounts',
      debtScore: 78,
      complexity: 28,
      blastRadius: 14,
      codeSnippet: `export function calculateTaxAndDiscounts(order) {
  let discount = 0;
  if (order.type === 'VIP') {
    if (order.total > 1000) discount = 0.2;
    else if (order.total > 500) discount = 0.15;
    else discount = 0.1;
  } else if (order.type === 'PRO') {
    if (order.total > 1000) discount = 0.1;
    else discount = 0.05;
  }
  let tax = 0;
  for (const item of order.items) {
    if (item.category === 'digital') tax += item.price * 0.05;
    else if (item.category === 'physical') tax += item.price * 0.18;
    else tax += item.price * 0.1;
  }
  return { discount, tax };
}`,
      securityScore: 10,
      vulnerabilityCount: 0,
      securityRiskLevel: 'low',
      owaspCategories: [],
      cweCategories: [],
      securityFindings: [],
    },
  },
  {
    name: 'Unsafe Deserialization Vulnerability',
    context: {
      filePath: 'src/utils/session.ts',
      symbolName: 'parseUserCookie',
      debtScore: 88,
      complexity: 8,
      blastRadius: 6,
      codeSnippet: `export function parseUserCookie(cookieStr) {
  const buf = Buffer.from(cookieStr, 'base64');
  return eval('(' + buf.toString() + ')');
}`,
      securityScore: 98,
      vulnerabilityCount: 1,
      securityRiskLevel: 'critical',
      owaspCategories: ['A08:2021-Software and Data Integrity Failures'],
      cweCategories: ['CWE-502'],
      securityFindings: [
        {
          title: 'Arbitrary Code Execution via eval of serialized cookie',
          severity: 'critical',
          recommendation: 'Replace eval() with JSON.parse() and signature verification.',
          evidence: "eval('(' + buf.toString() + ')')",
        },
      ],
    },
  },
];

export async function runAIEvaluationHarness(): Promise<EvalReport> {
  const results: EvalMetricResult[] = [];
  let totalLatency = 0;
  let passedCount = 0;
  let totalActionability = 0;
  let jargonViolations = 0;

  for (const benchmark of SYNTHETIC_EVAL_BENCHMARKS) {
    const start = Date.now();
    let explanation = '';
    try {
      explanation = await generateDebtExplanation(benchmark.context);
    } catch (err) {
      explanation = `Generation Error: ${err instanceof Error ? err.message : String(err)}`;
    }
    const durationMs = Date.now() - start;
    totalLatency += durationMs;

    const lower = explanation.toLowerCase();

    // Check for banned business words
    const foundBanned = BANNED_BUSINESS_WORDS.filter((word) =>
      new RegExp(`\\b${word}\\b`, 'i').test(lower)
    );
    if (foundBanned.length > 0) jargonViolations++;

    // Count technical terms
    const foundTech = TECHNICAL_TERMS.filter((term) =>
      new RegExp(`\\b${term}\\b`, 'i').test(lower)
    );

    // Structural sections check
    const hasSummary = /summary:/i.test(explanation) || /technical debt/i.test(explanation);
    const hasFixes = /fix/i.test(explanation) || /recommend/i.test(explanation) || /remediation/i.test(explanation);
    const hasRootCause = /cause/i.test(explanation) || /reason/i.test(explanation) || /vulnerability/i.test(explanation);
    const schemaValid = hasSummary && hasFixes && hasRootCause;

    // Actionability score formula (0 - 100)
    let actionability = 0;
    if (hasFixes) actionability += 35;
    if (hasRootCause) actionability += 25;
    if (foundTech.length >= 3) actionability += 20;
    if (foundBanned.length === 0) actionability += 20;
    totalActionability += actionability;

    const isPass = schemaValid && foundBanned.length === 0 && actionability >= 70;
    const isWarn = !isPass && actionability >= 50;
    const grade: 'PASS' | 'WARN' | 'FAIL' = isPass ? 'PASS' : isWarn ? 'WARN' : 'FAIL';

    if (grade === 'PASS') passedCount++;

    results.push({
      snippetName: benchmark.name,
      durationMs,
      schemaValid,
      bannedJargonCount: foundBanned.length,
      foundBannedWords: foundBanned,
      technicalTermCount: foundTech.length,
      actionabilityScore: actionability,
      explanationPreview: explanation.slice(0, 160) + (explanation.length > 160 ? '...' : ''),
      grade,
    });
  }

  const cacheStats = getExplanationCacheStats();

  return {
    timestamp: new Date().toISOString(),
    totalTests: SYNTHETIC_EVAL_BENCHMARKS.length,
    passedTests: passedCount,
    averageLatencyMs: Math.round(totalLatency / SYNTHETIC_EVAL_BENCHMARKS.length),
    bannedJargonViolations: jargonViolations,
    averageActionabilityScore: Math.round(totalActionability / SYNTHETIC_EVAL_BENCHMARKS.length),
    cacheStats,
    results,
  };
}
