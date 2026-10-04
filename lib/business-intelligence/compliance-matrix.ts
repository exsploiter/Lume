import type {
  AnalysisRecord,
  DebtNode,
  SecurityFinding,
  ComplianceFrameworkType,
  FrameworkControl,
  FrameworkEvaluation,
  ComprehensiveComplianceAudit,
} from '@/types';
import { clampScore } from '@/lib/risk-utils';

interface RawControlDefinition {
  id: string;
  framework: ComplianceFrameworkType;
  title: string;
  category: string;
  description: string;
  auditRequirement: string;
  keywords: string[];
  requiresZeroCritical: boolean;
  remediationGuidance: string;
}

const CONTROL_DEFINITIONS: RawControlDefinition[] = [
  // --- SOC 2 Type II ---
  {
    id: 'CC6.1',
    framework: 'SOC2',
    title: 'Logical Access and Authorization Boundaries',
    category: 'Access Control',
    description: 'The entity implements logical access security software, infrastructure, and architectures over protected resources.',
    auditRequirement: 'Ensure all API endpoints and sensitive internal symbols implement role/permission-based access control without authentication bypasses.',
    keywords: ['auth', 'authentication bypass', 'jwt', 'session', 'login', 'authorization', 'access control', 'privilege escalation', 'rbac'],
    requiresZeroCritical: true,
    remediationGuidance: 'Enforce authentication middleware on exposed routes and eliminate direct object references / bypass pathways.',
  },
  {
    id: 'CC6.6',
    framework: 'SOC2',
    title: 'Boundary Protection and Injection Defense',
    category: 'System Operations',
    description: 'The entity implements logical boundaries and sanitization to prevent unauthorized access and data injection.',
    auditRequirement: 'All user inputs to data layers, shell executors, and DOM output must be parameterized or strictly sanitized.',
    keywords: ['sql injection', 'command injection', 'xss', 'cross-site scripting', 'ssrf', 'path traversal', 'untrusted input'],
    requiresZeroCritical: true,
    remediationGuidance: 'Replace raw SQL/shell interpolations with parameterized ORM queries, safe APIs, and output encoders.',
  },
  {
    id: 'CC6.7',
    framework: 'SOC2',
    title: 'Data Transmission and Secrets Management',
    category: 'Data Protection',
    description: 'The entity restricts the transmission, movement, and storage of secrets and cryptographic keys.',
    auditRequirement: 'Zero plaintext credentials, API tokens, private keys, or passwords committed to source control.',
    keywords: ['secret', 'hardcoded secret', 'credential', 'api key', 'private key', 'token', 'password', 'entropy'],
    requiresZeroCritical: true,
    remediationGuidance: 'Revoke committed credentials immediately, purge git history with BFG/git-filter-repo, and migrate to KMS or environment secrets.',
  },
  {
    id: 'CC7.1',
    framework: 'SOC2',
    title: 'Vulnerability Detection and Static Analysis',
    category: 'Monitoring',
    description: 'The entity conducts vulnerability scanning and static security analysis across application codebases.',
    auditRequirement: 'Automated static AST analysis and vulnerability scanners must be executed in development and pull requests.',
    keywords: ['vulnerability', 'cve', 'cwe', 'prototype pollution', 'dos', 'regex dos', 'outdated dependency'],
    requiresZeroCritical: false,
    remediationGuidance: 'Integrate automated CI gate evaluations (DebtRadar gate) on every pull request to enforce zero unresolved high-risk findings.',
  },
  {
    id: 'CC7.2',
    framework: 'SOC2',
    title: 'System Stability and Architecture Resilience',
    category: 'Resilience',
    description: 'The entity monitors system capacity, architectural integrity, and blast radius of potential failures.',
    auditRequirement: 'Codebase architecture must not possess severe cyclic dependencies, extreme complexity hotspots, or single-point-of-collapse modules.',
    keywords: ['collapse', 'blast radius', 'circular dependency', 'coupling', 'cyclomatic complexity'],
    requiresZeroCritical: false,
    remediationGuidance: 'Refactor high blast-radius modules and decouple cyclic dependencies to prevent cascading system collapse.',
  },
  {
    id: 'CC8.1',
    framework: 'SOC2',
    title: 'Change Management and Deployment Gates',
    category: 'Change Management',
    description: 'The entity authorizes, designs, tests, and validates code changes prior to production deployment.',
    auditRequirement: 'All production releases must pass security threshold gates with auditable deployment confidence ratings.',
    keywords: ['deployment', 'gate', 'ci/cd', 'pr risk', 'regression'],
    requiresZeroCritical: true,
    remediationGuidance: 'Configure branch protection rules blocking merges when DebtRadar Trust Score falls below defined thresholds.',
  },

  // --- ISO/IEC 27001:2022 ---
  {
    id: 'A.8.8',
    framework: 'ISO27001',
    title: 'Management of Technical Vulnerabilities',
    category: 'Technological Controls',
    description: 'Information about technical vulnerabilities of information systems in use shall be obtained and evaluated.',
    auditRequirement: 'Technical vulnerabilities identified in source code must be cataloged, prioritized by exploitability, and remediated within SLAs.',
    keywords: ['vulnerability', 'cve', 'cwe', 'exploit', 'security flaw', 'patch'],
    requiresZeroCritical: true,
    remediationGuidance: 'Prioritize automated autofix generation and issue resolution for all CWE-mapped security findings.',
  },
  {
    id: 'A.8.24',
    framework: 'ISO27001',
    title: 'Use of Cryptography and Key Management',
    category: 'Technological Controls',
    description: 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.',
    auditRequirement: 'Cryptographic functions must use modern algorithms (e.g. AES-GCM, SHA-256) and never use hardcoded cryptographic keys or IVs.',
    keywords: ['secret', 'credential', 'cryptography', 'cipher', 'md5', 'sha1', 'weak crypto', 'hardcoded secret', 'key'],
    requiresZeroCritical: true,
    remediationGuidance: 'Replace weak hashing/ciphers with modern standard libraries and externalize cryptographic keys.',
  },
  {
    id: 'A.8.26',
    framework: 'ISO27001',
    title: 'Application Security Requirements',
    category: 'Technological Controls',
    description: 'Information security requirements shall be identified, specified and approved when developing or acquiring applications.',
    auditRequirement: 'Application entry points must enforce input validation, rate limiting, and defensive exception handling.',
    keywords: ['sql injection', 'command injection', 'xss', 'public exposure', 'attack surface', 'unvalidated input'],
    requiresZeroCritical: false,
    remediationGuidance: 'Adopt comprehensive schema validation (e.g. Zod) and parameterized query builders on all external interfaces.',
  },
  {
    id: 'A.8.28',
    framework: 'ISO27001',
    title: 'Secure Coding Practices and AST Analysis',
    category: 'Technological Controls',
    description: 'Secure coding principles shall be applied to software development.',
    auditRequirement: 'Code must adhere to OWASP Top 10 and CWE secure coding principles verified via static AST analysis.',
    keywords: ['ast', 'code quality', 'smell', 'prototype pollution', 'eval', 'unsafe reflection'],
    requiresZeroCritical: true,
    remediationGuidance: 'Eliminate unsafe constructs like `eval()`, direct string-to-code execution, and prototype mutations.',
  },
  {
    id: 'A.8.29',
    framework: 'ISO27001',
    title: 'Security Testing in Development and Acceptance',
    category: 'Technological Controls',
    description: 'Security testing processes shall be established and implemented in the development life cycle.',
    auditRequirement: 'Continuous static security and exploitability analysis integrated into version control workflows.',
    keywords: ['ci', 'test', 'security testing', 'pipeline', 'audit log'],
    requiresZeroCritical: false,
    remediationGuidance: 'Enable GitHub Actions webhook integration with DebtRadar for continuous security verification.',
  },

  // --- PCI-DSS v4.0 ---
  {
    id: 'Req-6.2',
    framework: 'PCI_DSS',
    title: 'Bespoke and Custom Software Vulnerability Remediation',
    category: 'Secure Systems',
    description: 'Bespoke and custom software is developed securely and vulnerabilities are remediated before release.',
    auditRequirement: 'Source code must be free from known critical and high-severity security vulnerabilities prior to cardholder data processing.',
    keywords: ['vulnerability', 'cve', 'cwe', 'critical', 'exploitability'],
    requiresZeroCritical: true,
    remediationGuidance: 'Ensure all critical security findings are fixed and verified clean prior to production build promotion.',
  },
  {
    id: 'Req-6.4',
    framework: 'PCI_DSS',
    title: 'Public-Facing Web Application Attack Defense',
    category: 'Application Protection',
    description: 'Public-facing web applications are protected against automated attacks and injection vulnerabilities.',
    auditRequirement: 'Defense against SQL injection, Cross-Site Scripting (XSS), Command Injection, and unauthorized remote code execution.',
    keywords: ['sql injection', 'command injection', 'xss', 'public exposure', 'attack path'],
    requiresZeroCritical: true,
    remediationGuidance: 'Implement context-aware output encoding, strict CSP headers, and input parameterization.',
  },
  {
    id: 'Req-8.3',
    framework: 'PCI_DSS',
    title: 'Strong Authentication and Access Control Management',
    category: 'Identity & Access',
    description: 'Strong authentication and secure credential management are enforced for all administrative and user access.',
    auditRequirement: 'No hardcoded credentials, cleartext tokens, or bypassable authentication routines.',
    keywords: ['auth', 'authentication bypass', 'jwt', 'secret', 'credential', 'token', 'session'],
    requiresZeroCritical: true,
    remediationGuidance: 'Implement robust multi-factor and token verification with secure session lifetime controls.',
  },

  // --- HIPAA Security Rule ---
  {
    id: 'HIPAA-164.312(a)',
    framework: 'HIPAA',
    title: 'Technical Access Controls and Unique User Identification',
    category: 'Technical Safeguards',
    description: 'Implement technical policies and procedures for electronic information systems that maintain electronic protected health information (ePHI).',
    auditRequirement: 'Strict verification of access authorizations, authentication integrity, and prevention of privilege escalation.',
    keywords: ['auth', 'authentication bypass', 'jwt', 'access control', 'privilege escalation', 'session'],
    requiresZeroCritical: true,
    remediationGuidance: 'Verify authorization checks on all medical record / user data retrieval endpoints.',
  },
  {
    id: 'HIPAA-164.312(e)',
    framework: 'HIPAA',
    title: 'Transmission Security and Encryption Safeguards',
    category: 'Technical Safeguards',
    description: 'Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.',
    auditRequirement: 'Secrets, certificates, and encryption keys must never be exposed or leaked in client-accessible code.',
    keywords: ['secret', 'credential', 'api key', 'encryption', 'hardcoded secret', 'transmission'],
    requiresZeroCritical: true,
    remediationGuidance: 'Rotate leaked secrets immediately and ensure all data in transit is encrypted using TLS 1.3.',
  },
  {
    id: 'HIPAA-164.308(a)(1)',
    framework: 'HIPAA',
    title: 'Security Management and Risk Analysis',
    category: 'Administrative Safeguards',
    description: 'Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI.',
    auditRequirement: 'Regular, continuous static code analysis and architectural risk assessments.',
    keywords: ['vulnerability', 'collapse', 'risk', 'exploitability', 'blast radius'],
    requiresZeroCritical: false,
    remediationGuidance: 'Establish periodic DebtRadar compliance review audits and track risk remediation metrics over time.',
  },

  // --- OWASP Top 10:2021 ---
  {
    id: 'A01:2021',
    framework: 'OWASP_TOP10',
    title: 'Broken Access Control',
    category: 'Access Control',
    description: 'Access control enforces policy such that users cannot act outside of their intended permissions.',
    auditRequirement: 'Enforce principle of least privilege, disable directory listing, and prevent IDOR / authentication bypasses.',
    keywords: ['auth', 'authentication bypass', 'access control', 'privilege', 'idor', 'jwt', 'session'],
    requiresZeroCritical: true,
    remediationGuidance: 'Implement central access control checks and validate user ownership on all entity queries.',
  },
  {
    id: 'A02:2021',
    framework: 'OWASP_TOP10',
    title: 'Cryptographic Failures',
    category: 'Cryptography',
    description: 'Failures related to cryptography (or lack thereof), which often lead to sensitive data exposure or system compromise.',
    auditRequirement: 'Zero plaintext sensitive secrets, deprecated hashing functions, or weak cipher modes in code.',
    keywords: ['secret', 'hardcoded secret', 'credential', 'api key', 'token', 'cryptography', 'md5', 'sha1', 'cipher'],
    requiresZeroCritical: true,
    remediationGuidance: 'Remove hardcoded secrets from code and store in secure secret managers; use SHA-256/bcrypt for hashing.',
  },
  {
    id: 'A03:2021',
    framework: 'OWASP_TOP10',
    title: 'Injection',
    category: 'Injection',
    description: 'User-supplied data is not validated, filtered, or sanitized by the application before execution.',
    auditRequirement: 'All SQL, NoSQL, OS command, and ORM interfaces must use parameterization and type validation.',
    keywords: ['sql injection', 'command injection', 'xss', 'cross-site scripting', 'ssrf', 'injection'],
    requiresZeroCritical: true,
    remediationGuidance: 'Use parameterized queries, object-relational mapping safely, and contextual output encoders.',
  },
  {
    id: 'A04:2021',
    framework: 'OWASP_TOP10',
    title: 'Insecure Design and Architectural Risk',
    category: 'Architecture',
    description: 'Insecure design represents risks related to design and architectural flaws.',
    auditRequirement: 'Threat modeling and architectural risk evaluation to identify failure propagation and blast radius risks.',
    keywords: ['collapse', 'blast radius', 'cyclic', 'propagation', 'coupling'],
    requiresZeroCritical: false,
    remediationGuidance: 'Refactor high-coupling modules and isolate architectural blast radiuses.',
  },
];

const FRAMEWORK_METADATA: Record<
  ComplianceFrameworkType,
  { displayName: string; version: string }
> = {
  SOC2: { displayName: 'SOC 2 Type II', version: '2017 Trust Services Criteria' },
  ISO27001: { displayName: 'ISO/IEC 27001', version: '2022 Annex A Controls' },
  PCI_DSS: { displayName: 'PCI-DSS', version: 'v4.0 Software Security' },
  HIPAA: { displayName: 'HIPAA Security Rule', version: '45 CFR Part 164' },
  OWASP_TOP10: { displayName: 'OWASP Top 10', version: '2021 Standard' },
};

export function evaluateComprehensiveCompliance(params: {
  analysis: AnalysisRecord;
  nodes: DebtNode[];
}): ComprehensiveComplianceAudit {
  const { analysis, nodes } = params;
  const findings: SecurityFinding[] = nodes.flatMap((node) => node.security_findings ?? []);
  const collapseScore = analysis.collapse_score ?? 0;
  const repoExploitability = analysis.repo_exploitability_score ?? 0;
  const criticalCount = analysis.critical_vulnerabilities ?? findings.filter((f) => f.severity === 'critical').length;

  const evaluatedControls: FrameworkControl[] = [];

  for (const def of CONTROL_DEFINITIONS) {
    // Find matching findings
    const matchingFindings = findings.filter((f) => {
      const text = `${f.title} ${f.description} ${f.category} ${(f.owaspIds ?? []).join(' ')} ${(f.cweIds ?? []).join(' ')}`.toLowerCase();
      return def.keywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    const matchingCriticals = matchingFindings.filter((f) => f.severity === 'critical');
    const matchingHighs = matchingFindings.filter((f) => f.severity === 'high');

    // Architecture collapse risk check for architecture controls
    const isArchitectureControl = def.category === 'Resilience' || def.category === 'Architecture';
    const hasCollapseRisk = isArchitectureControl && collapseScore > 65;

    // Collect violating files
    const violatingFiles = [
      ...new Set(matchingFindings.map((f) => f.filePath).filter(Boolean)),
    ];

    // Determine status
    let status: FrameworkControl['status'] = 'PASS';
    if (matchingCriticals.length > 0 || (def.requiresZeroCritical && matchingHighs.length > 1) || (isArchitectureControl && collapseScore > 75)) {
      status = 'FAIL';
    } else if (matchingFindings.length > 0 || hasCollapseRisk || (def.category === 'Identity & Access' && repoExploitability > 50)) {
      status = 'WARNING';
    }

    evaluatedControls.push({
      id: def.id,
      framework: def.framework,
      title: def.title,
      category: def.category,
      description: def.description,
      auditRequirement: def.auditRequirement,
      keywords: def.keywords,
      requiresZeroCritical: def.requiresZeroCritical,
      status,
      findingCount: matchingFindings.length,
      criticalFindingCount: matchingCriticals.length,
      violatingFiles: violatingFiles.slice(0, 10),
      remediationGuidance: def.remediationGuidance,
    });
  }

  // Group by framework
  const frameworksRecord = {} as Record<ComplianceFrameworkType, FrameworkEvaluation>;
  const allFrameworkTypes: ComplianceFrameworkType[] = ['SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'OWASP_TOP10'];

  const criticalGaps: string[] = [];
  const remediationRoadmap: ComprehensiveComplianceAudit['remediationRoadmap'] = [];

  for (const fw of allFrameworkTypes) {
    const fwControls = evaluatedControls.filter((c) => c.framework === fw);
    const passing = fwControls.filter((c) => c.status === 'PASS').length;
    const warning = fwControls.filter((c) => c.status === 'WARNING').length;
    const failing = fwControls.filter((c) => c.status === 'FAIL').length;
    const total = fwControls.length;

    // Compute readiness score
    const penalty = failing * 28 + warning * 12;
    const readinessScore = Math.round(clampScore(100 - (total > 0 ? (penalty / total) * 2.5 : 0), 0, 100));

    let fwStatus: FrameworkEvaluation['status'] = 'AUDIT_READY';
    if (failing > 0 || readinessScore < 70) {
      fwStatus = 'NON_COMPLIANT';
    } else if (warning > 0 || readinessScore < 90) {
      fwStatus = 'MINOR_GAPS';
    }

    const { displayName, version } = FRAMEWORK_METADATA[fw];

    let summary = '';
    if (fwStatus === 'AUDIT_READY') {
      summary = `${displayName} controls are fully satisfied with zero critical non-conformities.`;
    } else if (fwStatus === 'MINOR_GAPS') {
      summary = `${displayName} presents ${warning} control warning(s) requiring attention before final audit signoff.`;
    } else {
      summary = `${displayName} presents ${failing} failing control(s) and requires targeted remediation.`;
    }

    frameworksRecord[fw] = {
      framework: fw,
      displayName,
      version,
      readinessScore,
      status: fwStatus,
      totalControls: total,
      passingControls: passing,
      warningControls: warning,
      failingControls: failing,
      controls: fwControls,
      summary,
    };

    // Collect gaps and roadmap items
    for (const ctrl of fwControls) {
      if (ctrl.status === 'FAIL') {
        const gap = `[${displayName} ${ctrl.id}] ${ctrl.title}: ${ctrl.criticalFindingCount} critical finding(s) detected across ${ctrl.violatingFiles.length} file(s).`;
        if (!criticalGaps.includes(gap)) criticalGaps.push(gap);

        remediationRoadmap.push({
          priority: 'P0',
          controlId: ctrl.id,
          framework: fw,
          action: ctrl.remediationGuidance,
          estimatedEffort: ctrl.findingCount > 3 ? '1-2 days' : '2-4 hours',
        });
      } else if (ctrl.status === 'WARNING') {
        remediationRoadmap.push({
          priority: 'P1',
          controlId: ctrl.id,
          framework: fw,
          action: ctrl.remediationGuidance,
          estimatedEffort: '2-4 hours',
        });
      }
    }
  }

  // Calculate overall readiness score across all frameworks
  const avgFrameworkScore = Math.round(
    allFrameworkTypes.reduce((acc, fw) => acc + frameworksRecord[fw].readinessScore, 0) / allFrameworkTypes.length
  );

  let overallGrade: ComprehensiveComplianceAudit['overallGrade'] = 'Moderate';
  if (avgFrameworkScore >= 92) overallGrade = 'Excellent';
  else if (avgFrameworkScore >= 80) overallGrade = 'Strong';
  else if (avgFrameworkScore >= 65) overallGrade = 'Moderate';
  else if (avgFrameworkScore >= 50) overallGrade = 'Needs Improvement';
  else overallGrade = 'High Risk';

  return {
    analysisId: analysis.id,
    repoUrl: analysis.repo_url,
    repoOwner: analysis.repo_owner,
    repoName: analysis.repo_name,
    timestamp: analysis.created_at || new Date().toISOString(),
    overallReadinessScore: avgFrameworkScore,
    overallGrade,
    frameworks: frameworksRecord,
    criticalGaps,
    remediationRoadmap: remediationRoadmap.slice(0, 10),
    auditMetadata: {
      engineVersion: 'DebtRadar Compliance Core v2.4',
      totalFilesScanned: analysis.total_files ?? nodes.length,
      totalSymbolsParsed: analysis.total_nodes ?? nodes.length,
      findingsEvaluated: findings.length,
    },
  };
}
