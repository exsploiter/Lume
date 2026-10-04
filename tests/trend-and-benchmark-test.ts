import { extractTrendDataPoint, analyzeHistoricalTrend } from '../lib/business-intelligence/trend-analyzer';
import { calculatePeerBenchmark } from '../lib/business-intelligence/peer-benchmarking';
import type { AnalysisRecord } from '../types';

function mockAnalysisRecord(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    id: overrides.id || 'scan-1',
    user_id: null,
    repo_url: overrides.repo_url || 'https://github.com/acme/rocket',
    repo_owner: overrides.repo_owner || 'acme',
    repo_name: overrides.repo_name || 'rocket',
    status: 'complete',
    progress: 100,
    progress_message: null,
    error_message: null,
    total_files: overrides.total_files ?? 35,
    total_nodes: overrides.total_nodes ?? 120,
    avg_debt_score: overrides.avg_debt_score ?? 28,
    fingerprint_label: null,
    fingerprint_confidence: null,
    security_summary: overrides.security_summary ?? {
      totalVulnerabilities: 4,
      critical: overrides.critical_vulnerabilities ?? 1,
      high: 2,
      medium: 1,
      low: 0,
      score: overrides.repo_security_score ?? 75,
      categoryCounts: {},
      owaspCategories: ['A01:2021', 'A03:2021'],
      cweCategories: ['CWE-79', 'CWE-89'],
      topFindings: [],
    },
    security_collapse: overrides.security_collapse ?? false,
    critical_vulnerabilities: overrides.critical_vulnerabilities ?? 1,
    repo_security_score: overrides.repo_security_score ?? 75,
    collapse_score: overrides.collapse_score ?? 25,
    collapse_prediction: overrides.collapse_prediction ?? {
      collapseProbability: 25,
      collapseScore: 25,
      predictedTimeline: '6-12 months',
      criticalModules: [],
      instabilityDrivers: [],
      recommendedInterventions: [],
      riskTrend: [],
    },
    attack_graph: null,
    repo_exploitability_score: overrides.repo_exploitability_score ?? 30,
    high_risk_attack_paths: null,
    created_at: overrides.created_at || '2026-09-01T10:00:00Z',
    updated_at: overrides.updated_at || '2026-09-01T10:05:00Z',
    ...overrides,
  };
}

async function runTests() {
  console.log('🧪 Running Trend Analyzer & Peer Benchmarking Test Suite...\n');
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

  // --- 1. Test Single Scan (Baseline) ---
  console.log('--- Test 1: Baseline Historical Trend (Single Scan) ---');
  const scan1 = mockAnalysisRecord({
    id: 'scan-1',
    created_at: '2026-09-01T10:00:00Z',
    repo_security_score: 70,
    collapse_score: 30,
    critical_vulnerabilities: 2,
  });

  const trend1 = analyzeHistoricalTrend([scan1]);
  assert(trend1.totalScans === 1, 'Should record totalScans = 1');
  assert(trend1.trajectory === 'insufficient_data', 'Should have trajectory = insufficient_data for single scan');
  assert(trend1.history.length === 1, 'Should contain 1 history point');
  assert(trend1.trustScoreDelta === 0, 'Delta should be 0 on single scan');

  // --- 2. Test Multi-Scan Improving Trajectory ---
  console.log('\n--- Test 2: Improving Trajectory across Scans ---');
  const scan2 = mockAnalysisRecord({
    id: 'scan-2',
    created_at: '2026-09-08T10:00:00Z',
    repo_security_score: 85,
    collapse_score: 18,
    critical_vulnerabilities: 0,
    repo_exploitability_score: 15,
  });

  const trend2 = analyzeHistoricalTrend([scan1, scan2]);
  assert(trend2.totalScans === 2, 'Should record totalScans = 2');
  assert(trend2.trajectory === 'improving', `Trajectory should be 'improving', got: ${trend2.trajectory}`);
  assert(trend2.criticalVulnDelta === -2, `Critical vuln delta should be -2, got: ${trend2.criticalVulnDelta}`);
  assert(trend2.securityScoreDelta === 15, `Security score delta should be +15, got: ${trend2.securityScoreDelta}`);
  assert(trend2.trustScoreDelta > 0, `Trust score delta should be positive, got: ${trend2.trustScoreDelta}`);
  assert(trend2.insights.length > 0, 'Should generate actionable insights');

  // --- 3. Test Multi-Scan Degrading Trajectory ---
  console.log('\n--- Test 3: Degrading Trajectory with Regressions ---');
  const scan3 = mockAnalysisRecord({
    id: 'scan-3',
    created_at: '2026-09-15T10:00:00Z',
    repo_security_score: 45,
    collapse_score: 75,
    critical_vulnerabilities: 5,
    repo_exploitability_score: 80,
  });

  const trend3 = analyzeHistoricalTrend([scan2, scan3]);
  assert(trend3.trajectory === 'degrading', `Trajectory should be 'degrading', got: ${trend3.trajectory}`);
  assert(trend3.criticalVulnDelta === 5, `Critical vuln delta should be +5, got: ${trend3.criticalVulnDelta}`);
  assert(trend3.securityScoreDelta === -40, `Security score delta should be -40, got: ${trend3.securityScoreDelta}`);
  assert(trend3.trustScoreDelta < 0, `Trust score delta should be negative, got: ${trend3.trustScoreDelta}`);

  // --- 4. Test Peer Benchmarking Calculation ---
  console.log('\n--- Test 4: Peer Benchmarking Calculations ---');
  const targetScan = mockAnalysisRecord({
    id: 'target-repo',
    total_files: 45,
    repo_security_score: 88,
    collapse_score: 12,
    critical_vulnerabilities: 0,
    repo_exploitability_score: 18,
  });

  const cohort = [
    mockAnalysisRecord({ id: 'c-1', repo_security_score: 40, collapse_score: 60, critical_vulnerabilities: 4, repo_exploitability_score: 70 }),
    mockAnalysisRecord({ id: 'c-2', repo_security_score: 60, collapse_score: 45, critical_vulnerabilities: 2, repo_exploitability_score: 50 }),
    mockAnalysisRecord({ id: 'c-3', repo_security_score: 75, collapse_score: 30, critical_vulnerabilities: 1, repo_exploitability_score: 35 }),
  ];

  const benchmark = calculatePeerBenchmark(targetScan, cohort);
  assert(benchmark.overallPercentile >= 75, `High-performing repo should be >= 75th percentile, got: ${benchmark.overallPercentile}`);
  assert(benchmark.overallTier === 'Top Quartile' || benchmark.overallTier === 'Top 10%', `Overall tier should be Top Quartile or Top 10%, got: ${benchmark.overallTier}`);
  assert(benchmark.sizeCohort === 'Medium (20-100 files)', `Size cohort should be Medium, got: ${benchmark.sizeCohort}`);
  assert(benchmark.metrics.length === 6, `Should compute 6 benchmark metrics, got: ${benchmark.metrics.length}`);
  
  const secMetric = benchmark.metrics.find((m) => m.metric === 'Security Posture');
  assert(secMetric !== undefined && secMetric.percentile >= 70, `Security metric should rank high (>70), got: ${secMetric?.percentile}`);

  assert(benchmark.insights.length > 0, 'Should generate benchmark insights');
  assert(benchmark.recommendations.length > 0, 'Should generate benchmark recommendations');

  // --- 5. Test Small File Repository Cohort ---
  console.log('\n--- Test 5: Small Repository Size Classification ---');
  const smallScan = mockAnalysisRecord({ id: 'small-repo', total_files: 8 });
  const smallBenchmark = calculatePeerBenchmark(smallScan, []);
  assert(smallBenchmark.sizeCohort === 'Small (< 20 files)', `Size cohort should be Small, got: ${smallBenchmark.sizeCohort}`);

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
