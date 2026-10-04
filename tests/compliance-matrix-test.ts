import { evaluateComprehensiveCompliance } from '../lib/business-intelligence/compliance-matrix';
import {
  generateComplianceJson,
  generateComplianceMarkdown,
  generateComplianceCsv,
} from '../lib/business-intelligence/compliance-export';
import type { AnalysisRecord, DebtNode, SecurityFinding } from '../types';

function mockNode(overrides: Partial<DebtNode> = {}): DebtNode {
  return {
    id: overrides.id || 'node-1',
    analysis_id: 'analysis-1',
    file_path: overrides.file_path || 'lib/auth/jwt.ts',
    symbol_name: overrides.symbol_name || 'verifyToken',
    node_type: 'function',
    line_start: 1,
    line_end: 25,
    debt_score: 20,
    security_score: overrides.security_score ?? 80,
    security_weighted_score: overrides.security_weighted_score ?? 80,
    has_critical_security: overrides.has_critical_security ?? false,
    vulnerability_count: overrides.vulnerability_count ?? 0,
    security_risk_level: overrides.security_risk_level ?? 'none',
    exploitability_score: overrides.exploitability_score ?? 20,
    collapse_risk: 15,
    autofix_available: true,
    attack_surface_score: 25,
    propagation_risk: 15,
    public_exposure: false,
    critical_attack_paths: [],
    fix_patch: null,
    fix_confidence: 0.9,
    merge_risk: 'LOW',
    complexity: 5,
    duplication_score: 0,
    blast_radius: 10,
    owasp_categories: overrides.owasp_categories ?? [],
    cwe_categories: overrides.cwe_categories ?? [],
    security_findings: overrides.security_findings ?? [],
    dependencies: [],
    dependents: [],
    explanation: null,
    fingerprint_tag: null,
    x: null,
    y: null,
  };
}

function mockAnalysis(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    id: 'analysis-1',
    user_id: null,
    repo_url: 'https://github.com/acme/fintech-core',
    repo_owner: 'acme',
    repo_name: 'fintech-core',
    status: 'complete',
    progress: 100,
    progress_message: null,
    error_message: null,
    total_files: 25,
    total_nodes: 80,
    avg_debt_score: 22,
    fingerprint_label: null,
    fingerprint_confidence: null,
    security_summary: null,
    security_collapse: false,
    critical_vulnerabilities: overrides.critical_vulnerabilities ?? 0,
    repo_security_score: overrides.repo_security_score ?? 90,
    collapse_score: overrides.collapse_score ?? 15,
    collapse_prediction: null,
    attack_graph: null,
    repo_exploitability_score: overrides.repo_exploitability_score ?? 15,
    high_risk_attack_paths: null,
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-20T12:05:00Z',
    ...overrides,
  };
}

async function runTests() {
  console.log('🧪 Running Compliance Framework Matrix & Export Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: unknown, msg: string) {
    if (Boolean(condition)) {
      console.log(`  ✅ ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // --- 1. Test Clean Repository (High Compliance) ---
  console.log('--- Test 1: Clean Repository Compliance Evaluation ---');
  const cleanAnalysis = mockAnalysis({ repo_security_score: 95, critical_vulnerabilities: 0, collapse_score: 10 });
  const cleanNodes = [mockNode()];

  const cleanAudit = evaluateComprehensiveCompliance({ analysis: cleanAnalysis, nodes: cleanNodes });
  assert(cleanAudit.overallReadinessScore >= 90, `Clean repo readiness score should be >= 90, got: ${cleanAudit.overallReadinessScore}`);
  assert(cleanAudit.overallGrade === 'Excellent' || cleanAudit.overallGrade === 'Strong', `Clean repo grade should be Excellent/Strong, got: ${cleanAudit.overallGrade}`);
  assert(cleanAudit.frameworks.SOC2.status === 'AUDIT_READY', `SOC 2 should be AUDIT_READY, got: ${cleanAudit.frameworks.SOC2.status}`);
  assert(cleanAudit.frameworks.ISO27001.status === 'AUDIT_READY', `ISO 27001 should be AUDIT_READY, got: ${cleanAudit.frameworks.ISO27001.status}`);
  assert(cleanAudit.criticalGaps.length === 0, `Clean repo should have 0 critical gaps, got: ${cleanAudit.criticalGaps.length}`);

  // --- 2. Test Vulnerable Repository (Failing Controls) ---
  console.log('\n--- Test 2: Vulnerable Repository with Secret Leak & SQLi ---');
  const secretFinding: SecurityFinding = {
    id: 'f-1',
    ruleId: 'SEC-001',
    title: 'Hardcoded API Secret in config',
    description: 'Plaintext AWS secret key committed in codebase',
    severity: 'critical',
    filePath: 'config/aws.ts',
    lineStart: 12,
    lineEnd: 12,
    evidence: 'const AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"',
    recommendation: 'Use AWS Secrets Manager',
    occurrenceCount: 1,
    exploitability: 95,
    owaspIds: ['A02:2021'],
    cweIds: ['CWE-798'],
    category: 'Hardcoded Secret',
  };

  const sqliFinding: SecurityFinding = {
    id: 'f-2',
    ruleId: 'SEC-002',
    title: 'SQL Injection in User Query',
    description: 'Raw string concatenation in SQL execute query',
    severity: 'critical',
    filePath: 'db/users.ts',
    lineStart: 45,
    lineEnd: 46,
    evidence: 'db.query("SELECT * FROM users WHERE id = " + req.params.id)',
    recommendation: 'Use parameterized queries',
    occurrenceCount: 1,
    exploitability: 90,
    owaspIds: ['A03:2021'],
    cweIds: ['CWE-89'],
    category: 'SQL Injection',
  };

  const vulnAnalysis = mockAnalysis({
    repo_security_score: 45,
    critical_vulnerabilities: 2,
    repo_exploitability_score: 85,
    collapse_score: 70,
  });

  const vulnNodes = [
    mockNode({ file_path: 'config/aws.ts', security_findings: [secretFinding], has_critical_security: true }),
    mockNode({ file_path: 'db/users.ts', security_findings: [sqliFinding], has_critical_security: true }),
  ];

  const vulnAudit = evaluateComprehensiveCompliance({ analysis: vulnAnalysis, nodes: vulnNodes });
  assert(vulnAudit.overallReadinessScore < 80, `Vuln repo readiness should be < 80, got: ${vulnAudit.overallReadinessScore}`);
  assert(vulnAudit.frameworks.SOC2.failingControls > 0, `SOC 2 should have failing controls, got: ${vulnAudit.frameworks.SOC2.failingControls}`);
  
  // Verify CC6.7 (Secrets Management) failed
  const cc67 = vulnAudit.frameworks.SOC2.controls.find((c) => c.id === 'CC6.7');
  assert(cc67 !== undefined && cc67.status === 'FAIL', `CC6.7 should FAIL due to secret leak, got: ${cc67?.status}`);
  assert(cc67?.violatingFiles.includes('config/aws.ts'), 'CC6.7 should list config/aws.ts as violating file');

  // Verify CC6.6 (Injection Defense) failed
  const cc66 = vulnAudit.frameworks.SOC2.controls.find((c) => c.id === 'CC6.6');
  assert(cc66 !== undefined && cc66.status === 'FAIL', `CC6.6 should FAIL due to SQLi, got: ${cc66?.status}`);

  // Verify ISO A.8.24 (Crypto & Secrets) failed
  const a824 = vulnAudit.frameworks.ISO27001.controls.find((c) => c.id === 'A.8.24');
  assert(a824 !== undefined && a824.status === 'FAIL', `ISO A.8.24 should FAIL, got: ${a824?.status}`);

  // Verify Remediation Roadmap contains P0 items
  const p0Items = vulnAudit.remediationRoadmap.filter((r) => r.priority === 'P0');
  assert(p0Items.length > 0, `Should have P0 remediation roadmap items, got: ${p0Items.length}`);
  assert(vulnAudit.criticalGaps.length > 0, `Should have critical gaps, got: ${vulnAudit.criticalGaps.length}`);

  // --- 3. Test Export Generators ---
  console.log('\n--- Test 3: Export Generators (JSON, Markdown, CSV) ---');
  
  // JSON
  const jsonOutput = generateComplianceJson(vulnAudit);
  const parsedJson = JSON.parse(jsonOutput);
  assert(parsedJson.analysisId === 'analysis-1', 'JSON export should include analysisId');
  assert(parsedJson.frameworks.SOC2 !== undefined, 'JSON export should include SOC2 framework');

  // Markdown
  const mdOutput = generateComplianceMarkdown(vulnAudit);
  assert(mdOutput.includes('# DebtRadar Security & Governance Audit Report'), 'Markdown should include title');
  assert(mdOutput.includes('SOC 2 Type II'), 'Markdown should include SOC 2 section');
  assert(mdOutput.includes('CC6.7'), 'Markdown should include CC6.7 control');
  assert(mdOutput.includes('Prioritized Remediation Roadmap'), 'Markdown should include roadmap');

  // CSV
  const csvOutput = generateComplianceCsv(vulnAudit);
  assert(csvOutput.includes('Framework,Control ID,Control Title'), 'CSV should include headers');
  assert(csvOutput.includes('CC6.7'), 'CSV should include CC6.7 row');
  assert(csvOutput.includes('FAIL'), 'CSV should include FAIL status');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
