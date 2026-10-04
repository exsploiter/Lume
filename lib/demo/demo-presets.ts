import type { AnalysisRecord, DebtNode, SecurityFinding, AttackPath } from '@/types';
import { saveLocalAnalysisRecord, saveLocalDebtNodes } from '@/lib/supabase/local-store';
import { insertAnalysisRecord, insertDebtNodes } from '@/lib/supabase/server';
import { DEMO_PRESETS, DemoPresetMeta } from './demo-types';

export { DEMO_PRESETS, type DemoPresetMeta };

export async function seedDemoPreset(presetId: DemoPresetMeta['id']): Promise<string> {
  const meta = DEMO_PRESETS.find((p) => p.id === presetId) || DEMO_PRESETS[0];
  const analysisId = `demo-${meta.id}`;
  const now = new Date().toISOString();
  const pastWeek1 = new Date(Date.now() - 14 * 86400000).toISOString();
  const pastWeek2 = new Date(Date.now() - 7 * 86400000).toISOString();

  let analysis: AnalysisRecord;
  let nodes: DebtNode[] = [];
  let historicalRecords: AnalysisRecord[] = [];

  if (presetId === 'fintech-core-banking') {
    const findings: SecurityFinding[] = [
      {
        id: 'sec-001',
        ruleId: 'SEC-SECRETS',
        title: 'Plaintext AWS Secret Key Exposed',
        description: 'Hardcoded AWS secret key committed in ledger configuration.',
        severity: 'critical',
        filePath: 'src/config/aws.ts',
        lineStart: 14,
        lineEnd: 14,
        evidence: 'const AWS_SECRET = "AKIAIOSFODNN7EXAMPLE";',
        recommendation: 'Use AWS Secrets Manager or KMS',
        occurrenceCount: 1,
        exploitability: 95,
        owaspIds: ['A02:2021'],
        cweIds: ['CWE-798'],
        category: 'Hardcoded Secret',
      },
      {
        id: 'sec-002',
        ruleId: 'SEC-SQLI',
        title: 'SQL Injection in Account Ledger Query',
        description: 'Direct string interpolation in database transaction execution.',
        severity: 'critical',
        filePath: 'src/ledger/transactions.ts',
        lineStart: 88,
        lineEnd: 90,
        evidence: 'db.raw(`SELECT * FROM ledger WHERE account_id = ${accountId}`)',
        recommendation: 'Use parameterized SQL queries',
        occurrenceCount: 1,
        exploitability: 90,
        owaspIds: ['A03:2021'],
        cweIds: ['CWE-89'],
        category: 'SQL Injection',
      },
      {
        id: 'sec-003',
        ruleId: 'SEC-AUTH-BYPASS',
        title: 'JWT Signature Verification Bypass',
        description: 'Algorithm "none" allowed in token verification header.',
        severity: 'critical',
        filePath: 'src/auth/jwt.ts',
        lineStart: 42,
        lineEnd: 45,
        evidence: 'jwt.verify(token, secret, { algorithms: ["HS256", "none"] })',
        recommendation: 'Enforce strict algorithms array without "none"',
        occurrenceCount: 1,
        exploitability: 92,
        owaspIds: ['A01:2021', 'A07:2021'],
        cweIds: ['CWE-287'],
        category: 'Authentication Bypass',
      },
    ];

    const attackPaths: AttackPath[] = [
      {
        sourceNode: 'src/api/routes/payments.ts::handlePayment',
        targetNode: 'src/ledger/transactions.ts::executeTransfer',
        path: [
          'src/api/routes/payments.ts::handlePayment',
          'src/auth/jwt.ts::verifyToken',
          'src/ledger/transactions.ts::executeTransfer',
        ],
        propagationRisk: 88,
        attackComplexity: 15,
        privilegeEscalationPotential: 95,
        exposedApis: ['/api/v1/payments/transfer'],
        exploitabilityScore: 92,
      },
    ];

    analysis = {
      id: analysisId,
      user_id: null,
      repo_url: meta.repoUrl,
      repo_owner: meta.repoOwner,
      repo_name: meta.repoName,
      status: 'complete',
      progress: 100,
      progress_message: 'Analysis complete',
      error_message: null,
      total_files: 45,
      total_nodes: 140,
      avg_debt_score: 68,
      fingerprint_label: 'Agent-generated boilerplate with high complexity',
      fingerprint_confidence: 0.88,
      security_summary: {
        totalVulnerabilities: 8,
        critical: 3,
        high: 3,
        medium: 2,
        low: 0,
        score: 35,
        categoryCounts: { 'Hardcoded Secret': 1, 'SQL Injection': 1, 'Authentication Bypass': 1 },
        owaspCategories: ['A01:2021', 'A02:2021', 'A03:2021'],
        cweCategories: ['CWE-798', 'CWE-89', 'CWE-287'],
        topFindings: findings,
      },
      security_collapse: true,
      critical_vulnerabilities: 3,
      repo_security_score: 35,
      collapse_score: 78,
      collapse_prediction: {
        collapseProbability: 78,
        collapseScore: 78,
        predictedTimeline: '1-3 months',
        criticalModules: ['src/ledger/transactions.ts', 'src/auth/jwt.ts'],
        instabilityDrivers: ['Exposed AWS credentials', 'High cyclic coupling in payments module'],
        recommendedInterventions: ['Rotate AWS keys', 'Apply parameterized ORM queries', 'Fix JWT auth verification'],
        riskTrend: [
          { label: '30d ago', value: 45 },
          { label: '14d ago', value: 62 },
          { label: 'Current', value: 78 },
        ],
      },
      attack_graph: {
        paths: attackPaths,
        nodes: ['src/api/routes/payments.ts', 'src/auth/jwt.ts', 'src/ledger/transactions.ts'],
        links: [
          { source: 'src/api/routes/payments.ts', target: 'src/auth/jwt.ts', weight: 80 },
          { source: 'src/auth/jwt.ts', target: 'src/ledger/transactions.ts', weight: 90 },
        ],
        propagationRisk: 88,
        criticalPaths: attackPaths,
      },
      repo_exploitability_score: 85,
      high_risk_attack_paths: attackPaths,
      trustScore: 34,
      deploymentRecommendation: 'HIGH RISK',
      deploymentConfidence: 28,
      created_at: now,
      updated_at: now,
    };

    nodes = [
      {
        id: `${analysisId}-node-1`,
        analysis_id: analysisId,
        file_path: 'src/config/aws.ts',
        symbol_name: 'AWS_CONFIG',
        node_type: 'variable',
        line_start: 1,
        line_end: 20,
        debt_score: 75,
        security_score: 25,
        security_weighted_score: 25,
        has_critical_security: true,
        vulnerability_count: 1,
        security_risk_level: 'critical',
        exploitability_score: 95,
        collapse_risk: 70,
        autofix_available: true,
        attack_surface_score: 85,
        propagation_risk: 80,
        public_exposure: true,
        critical_attack_paths: [],
        fix_patch: '- const AWS_SECRET = "AKIAIOSFODNN7EXAMPLE";\n+ const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY;',
        fix_confidence: 0.95,
        merge_risk: 'CRITICAL',
        complexity: 4,
        duplication_score: 0,
        blast_radius: 18,
        owasp_categories: ['A02:2021'],
        cwe_categories: ['CWE-798'],
        security_findings: [findings[0]],
        dependencies: [],
        dependents: ['src/ledger/transactions.ts'],
        explanation: 'Plaintext credentials allow full takeover of underlying AWS infrastructure.',
        fingerprint_tag: 'config',
        x: null,
        y: null,
      },
      {
        id: `${analysisId}-node-2`,
        analysis_id: analysisId,
        file_path: 'src/ledger/transactions.ts',
        symbol_name: 'executeTransfer',
        node_type: 'function',
        line_start: 50,
        line_end: 110,
        debt_score: 82,
        security_score: 20,
        security_weighted_score: 20,
        has_critical_security: true,
        vulnerability_count: 1,
        security_risk_level: 'critical',
        exploitability_score: 90,
        collapse_risk: 85,
        autofix_available: true,
        attack_surface_score: 90,
        propagation_risk: 88,
        public_exposure: true,
        critical_attack_paths: attackPaths,
        fix_patch: '- db.raw(`SELECT * FROM ledger WHERE account_id = ${accountId}`)\n+ db("ledger").where({ account_id: accountId })',
        fix_confidence: 0.92,
        merge_risk: 'CRITICAL',
        complexity: 18,
        duplication_score: 15,
        blast_radius: 28,
        owasp_categories: ['A03:2021'],
        cwe_categories: ['CWE-89'],
        security_findings: [findings[1]],
        dependencies: ['src/auth/jwt.ts'],
        dependents: ['src/api/routes/payments.ts'],
        explanation: 'Unsanitized input allows arbitrary SQL execution in account ledger.',
        fingerprint_tag: 'ledger',
        x: null,
        y: null,
      },
    ];

    // Seed historical trend
    historicalRecords = [
      { ...analysis, id: `${analysisId}-hist-1`, created_at: pastWeek1, repo_security_score: 55, collapse_score: 45, critical_vulnerabilities: 1, trustScore: 52 },
      { ...analysis, id: `${analysisId}-hist-2`, created_at: pastWeek2, repo_security_score: 42, collapse_score: 65, critical_vulnerabilities: 2, trustScore: 41 },
      analysis,
    ];
  } else if (presetId === 'cloud-native-saas') {
    analysis = {
      id: analysisId,
      user_id: null,
      repo_url: meta.repoUrl,
      repo_owner: meta.repoOwner,
      repo_name: meta.repoName,
      status: 'complete',
      progress: 100,
      progress_message: 'Analysis complete',
      error_message: null,
      total_files: 85,
      total_nodes: 260,
      avg_debt_score: 38,
      fingerprint_label: 'Standard TypeScript microservice',
      fingerprint_confidence: 0.94,
      security_summary: {
        totalVulnerabilities: 3,
        critical: 0,
        high: 1,
        medium: 2,
        low: 0,
        score: 76,
        categoryCounts: { 'CORS Misconfiguration': 1, 'Missing Rate Limit': 2 },
        owaspCategories: ['A05:2021'],
        cweCategories: ['CWE-942'],
        topFindings: [],
      },
      security_collapse: false,
      critical_vulnerabilities: 0,
      repo_security_score: 76,
      collapse_score: 28,
      collapse_prediction: {
        collapseProbability: 28,
        collapseScore: 28,
        predictedTimeline: '12+ months',
        criticalModules: ['src/billing/stripe-webhook.ts'],
        instabilityDrivers: ['Moderate retry buffer queue depth'],
        recommendedInterventions: ['Add rate limiting on webhook ingestion'],
        riskTrend: [{ label: '14d ago', value: 42 }, { label: 'Current', value: 28 }],
      },
      attack_graph: null,
      repo_exploitability_score: 32,
      high_risk_attack_paths: null,
      trustScore: 74,
      deploymentRecommendation: 'NEEDS REVIEW',
      deploymentConfidence: 78,
      created_at: now,
      updated_at: now,
    };

    nodes = [
      {
        id: `${analysisId}-node-1`,
        analysis_id: analysisId,
        file_path: 'src/billing/stripe-webhook.ts',
        symbol_name: 'handleStripeWebhook',
        node_type: 'function',
        line_start: 20,
        line_end: 65,
        debt_score: 35,
        security_score: 75,
        security_weighted_score: 75,
        has_critical_security: false,
        vulnerability_count: 1,
        security_risk_level: 'medium',
        exploitability_score: 30,
        collapse_risk: 25,
        autofix_available: true,
        attack_surface_score: 35,
        propagation_risk: 25,
        public_exposure: true,
        critical_attack_paths: [],
        fix_patch: '+ import rateLimit from "express-rate-limit";',
        fix_confidence: 0.94,
        merge_risk: 'LOW',
        complexity: 8,
        duplication_score: 2,
        blast_radius: 12,
        owasp_categories: ['A05:2021'],
        cwe_categories: ['CWE-942'],
        security_findings: [],
        dependencies: [],
        dependents: [],
        explanation: 'Missing rate limit on webhook endpoint allows traffic spikes.',
        fingerprint_tag: 'webhook',
        x: null,
        y: null,
      },
    ];

    historicalRecords = [
      { ...analysis, id: `${analysisId}-hist-1`, created_at: pastWeek1, repo_security_score: 60, collapse_score: 42, critical_vulnerabilities: 1, trustScore: 60 },
      analysis,
    ];
  } else {
    // Enterprise IDP Gateway (94 Trust Score)
    analysis = {
      id: analysisId,
      user_id: null,
      repo_url: meta.repoUrl,
      repo_owner: meta.repoOwner,
      repo_name: meta.repoName,
      status: 'complete',
      progress: 100,
      progress_message: 'Analysis complete',
      error_message: null,
      total_files: 120,
      total_nodes: 400,
      avg_debt_score: 18,
      fingerprint_label: 'Hardened Zero-Trust Go/TypeScript Gateway',
      fingerprint_confidence: 0.98,
      security_summary: {
        totalVulnerabilities: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        score: 96,
        categoryCounts: {},
        owaspCategories: [],
        cweCategories: [],
        topFindings: [],
      },
      security_collapse: false,
      critical_vulnerabilities: 0,
      repo_security_score: 96,
      collapse_score: 8,
      collapse_prediction: {
        collapseProbability: 8,
        collapseScore: 8,
        predictedTimeline: 'Resilient (no collapse projected)',
        criticalModules: [],
        instabilityDrivers: [],
        recommendedInterventions: ['Maintain automated PR gates'],
        riskTrend: [{ label: '30d ago', value: 12 }, { label: 'Current', value: 8 }],
      },
      attack_graph: null,
      repo_exploitability_score: 12,
      high_risk_attack_paths: null,
      trustScore: 94,
      deploymentRecommendation: 'SAFE TO SHIP',
      deploymentConfidence: 96,
      created_at: now,
      updated_at: now,
    };

    nodes = [
      {
        id: `${analysisId}-node-1`,
        analysis_id: analysisId,
        file_path: 'pkg/auth/zero_trust.go',
        symbol_name: 'ValidateMtlsHeader',
        node_type: 'function',
        line_start: 1,
        line_end: 45,
        debt_score: 12,
        security_score: 98,
        security_weighted_score: 98,
        has_critical_security: false,
        vulnerability_count: 0,
        security_risk_level: 'none',
        exploitability_score: 8,
        collapse_risk: 6,
        autofix_available: false,
        attack_surface_score: 15,
        propagation_risk: 8,
        public_exposure: false,
        critical_attack_paths: [],
        fix_patch: null,
        fix_confidence: 1.0,
        merge_risk: 'LOW',
        complexity: 4,
        duplication_score: 0,
        blast_radius: 5,
        owasp_categories: [],
        cwe_categories: [],
        security_findings: [],
        dependencies: [],
        dependents: [],
        explanation: 'Hardened mTLS validator with strict signature and expiration checks.',
        fingerprint_tag: 'auth',
        x: null,
        y: null,
      },
    ];

    historicalRecords = [
      { ...analysis, id: `${analysisId}-hist-1`, created_at: pastWeek1, repo_security_score: 90, collapse_score: 14, critical_vulnerabilities: 0, trustScore: 89 },
      analysis,
    ];
  }

  // Persist demo analyses
  for (const hist of historicalRecords) {
    try {
      await insertAnalysisRecord(hist);
    } catch {
      await saveLocalAnalysisRecord(hist);
    }
  }

  try {
    await insertDebtNodes(nodes);
  } catch {
    await saveLocalDebtNodes(analysisId, nodes);
  }

  return analysisId;
}
