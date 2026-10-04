import type { AnalysisRecord, MetricBenchmark, PeerBenchmarkResult } from '@/types';
import { extractTrendDataPoint } from './trend-analyzer';

interface BenchmarkStat {
  values: number[];
  median: number;
  top10: number;
  bottom10: number;
}

function computeQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function calculatePercentile(values: number[], target: number): number {
  if (values.length === 0) return 50;
  let strictlyLower = 0;
  let equals = 0;
  for (const v of values) {
    if (v < target) strictlyLower++;
    else if (v === target) equals++;
  }
  const raw = ((strictlyLower + 0.5 * equals) / values.length) * 100;
  return Math.min(99, Math.max(1, Math.round(raw)));
}

function classifyTier(percentile: number): {
  tier: MetricBenchmark['tier'];
  status: MetricBenchmark['status'];
} {
  if (percentile >= 90) return { tier: 'Top 10%', status: 'positive' };
  if (percentile >= 75) return { tier: 'Top Quartile', status: 'positive' };
  if (percentile >= 50) return { tier: 'Above Average', status: 'positive' };
  if (percentile >= 25) return { tier: 'Below Average', status: 'neutral' };
  return { tier: 'Bottom Quartile', status: 'negative' };
}

// Industry baseline distribution samples for calibration when database cohort is small
const BASELINE_COHORT_SAMPLES = [
  { trust: 42, security: 35, archHealth: 50, exploitResist: 45, vulnHygiene: 40, debtHealth: 48, files: 15 },
  { trust: 55, security: 48, archHealth: 62, exploitResist: 58, vulnHygiene: 60, debtHealth: 55, files: 32 },
  { trust: 63, security: 58, archHealth: 68, exploitResist: 65, vulnHygiene: 70, debtHealth: 64, files: 45 },
  { trust: 71, security: 68, archHealth: 74, exploitResist: 72, vulnHygiene: 80, debtHealth: 72, files: 60 },
  { trust: 78, security: 75, archHealth: 80, exploitResist: 79, vulnHygiene: 88, debtHealth: 79, files: 85 },
  { trust: 84, security: 82, archHealth: 86, exploitResist: 85, vulnHygiene: 92, debtHealth: 85, files: 120 },
  { trust: 91, security: 90, archHealth: 92, exploitResist: 93, vulnHygiene: 98, debtHealth: 92, files: 210 },
  { trust: 36, security: 30, archHealth: 42, exploitResist: 38, vulnHygiene: 30, debtHealth: 40, files: 18 },
  { trust: 67, security: 64, archHealth: 70, exploitResist: 69, vulnHygiene: 75, debtHealth: 68, files: 52 },
  { trust: 88, security: 87, archHealth: 89, exploitResist: 88, vulnHygiene: 95, debtHealth: 88, files: 140 },
];

export function calculatePeerBenchmark(
  target: AnalysisRecord,
  cohort: AnalysisRecord[] = []
): PeerBenchmarkResult {
  const targetPoint = extractTrendDataPoint(target);
  const targetTrust = targetPoint.trustScore;
  const targetSecurity = targetPoint.repoSecurityScore;
  const targetArchHealth = Math.max(0, Math.min(100, 100 - targetPoint.collapseScore));
  const targetExploitResist = Math.max(0, Math.min(100, 100 - targetPoint.repoExploitabilityScore));
  const targetCritical = targetPoint.criticalVulnerabilities;
  const targetTotalVulns = targetPoint.totalVulnerabilities;
  const targetVulnHygiene = Math.max(0, Math.min(100, 100 - targetCritical * 25 - (targetTotalVulns - targetCritical) * 5));
  const targetDebtHealth = Math.max(0, Math.min(100, 100 - targetPoint.avgDebtScore));
  const targetFiles = targetPoint.totalFiles;

  // Build cohort metric pools
  const trustPool: number[] = [];
  const securityPool: number[] = [];
  const archHealthPool: number[] = [];
  const exploitResistPool: number[] = [];
  const vulnHygienePool: number[] = [];
  const debtHealthPool: number[] = [];

  // Extract from real DB records
  for (const record of cohort) {
    if (record.id === target.id) continue;
    const pt = extractTrendDataPoint(record);
    trustPool.push(pt.trustScore);
    securityPool.push(pt.repoSecurityScore);
    archHealthPool.push(Math.max(0, Math.min(100, 100 - pt.collapseScore)));
    exploitResistPool.push(Math.max(0, Math.min(100, 100 - pt.repoExploitabilityScore)));
    const crit = pt.criticalVulnerabilities;
    const tot = pt.totalVulnerabilities;
    vulnHygienePool.push(Math.max(0, Math.min(100, 100 - crit * 25 - (tot - crit) * 5)));
    debtHealthPool.push(Math.max(0, Math.min(100, 100 - pt.avgDebtScore)));
  }

  // If pool is small (< 10), merge calibrated baseline samples
  if (trustPool.length < 10) {
    for (const b of BASELINE_COHORT_SAMPLES) {
      trustPool.push(b.trust);
      securityPool.push(b.security);
      archHealthPool.push(b.archHealth);
      exploitResistPool.push(b.exploitResist);
      vulnHygienePool.push(b.vulnHygiene);
      debtHealthPool.push(b.debtHealth);
    }
  }

  // Include target value in distributions
  trustPool.push(targetTrust);
  securityPool.push(targetSecurity);
  archHealthPool.push(targetArchHealth);
  exploitResistPool.push(targetExploitResist);
  vulnHygienePool.push(targetVulnHygiene);
  debtHealthPool.push(targetDebtHealth);

  // Sort pools ascending
  trustPool.sort((a, b) => a - b);
  securityPool.sort((a, b) => a - b);
  archHealthPool.sort((a, b) => a - b);
  exploitResistPool.sort((a, b) => a - b);
  vulnHygienePool.sort((a, b) => a - b);
  debtHealthPool.sort((a, b) => a - b);

  function createMetric(name: string, targetVal: number, pool: number[]): MetricBenchmark {
    const pct = calculatePercentile(pool, targetVal);
    const { tier, status } = classifyTier(pct);
    return {
      metric: name,
      targetValue: Math.round(targetVal * 10) / 10,
      cohortMedian: Math.round(computeQuantile(pool, 0.5) * 10) / 10,
      cohortTop10: Math.round(computeQuantile(pool, 0.9) * 10) / 10,
      cohortBottom10: Math.round(computeQuantile(pool, 0.1) * 10) / 10,
      percentile: pct,
      tier,
      status,
    };
  }

  const metrics: MetricBenchmark[] = [
    createMetric('Overall Trust Score', targetTrust, trustPool),
    createMetric('Security Posture', targetSecurity, securityPool),
    createMetric('Architecture Stability', targetArchHealth, archHealthPool),
    createMetric('Exploitability Resistance', targetExploitResist, exploitResistPool),
    createMetric('Vulnerability Hygiene', targetVulnHygiene, vulnHygienePool),
    createMetric('Code Debt Health', targetDebtHealth, debtHealthPool),
  ];

  // Overall percentile is weighted average of individual metric percentiles
  const trustPct = metrics[0].percentile;
  const secPct = metrics[1].percentile;
  const archPct = metrics[2].percentile;
  const exploitPct = metrics[3].percentile;
  const hygiPct = metrics[4].percentile;

  const weightedPercentile = Math.round(
    trustPct * 0.35 +
    secPct * 0.25 +
    archPct * 0.15 +
    exploitPct * 0.15 +
    hygiPct * 0.10
  );

  const overallPercentile = Math.min(99, Math.max(1, weightedPercentile));
  const { tier: overallTier } = classifyTier(overallPercentile);

  // Size Cohort
  let sizeCohort: PeerBenchmarkResult['sizeCohort'] = 'Medium (20-100 files)';
  if (targetFiles < 20) {
    sizeCohort = 'Small (< 20 files)';
  } else if (targetFiles > 100) {
    sizeCohort = 'Large (> 100 files)';
  }

  // Actionable Insights & Recommendations
  const insights: string[] = [];
  const recommendations: string[] = [];

  const strongMetrics = metrics.filter((m) => m.percentile >= 75);
  const weakMetrics = metrics.filter((m) => m.percentile < 50);

  if (overallPercentile >= 80) {
    insights.push(`Your repository outperforms ${overallPercentile}% of peer codebases across the benchmark cohort.`);
  } else if (overallPercentile >= 50) {
    insights.push(`Your repository ranks above peer average at the ${overallPercentile}th percentile.`);
  } else {
    insights.push(`Your repository is in the ${overallTier.toLowerCase()} (${overallPercentile}th percentile) compared to peer cohort.`);
  }

  if (strongMetrics.length > 0) {
    const topNames = strongMetrics.map((m) => m.metric).join(', ');
    insights.push(`Key competitive strengths: ${topNames} (${strongMetrics[0].tier}).`);
  }

  if (weakMetrics.length > 0) {
    for (const w of weakMetrics) {
      if (w.metric === 'Exploitability Resistance') {
        recommendations.push(
          `Exploitability resistance is below peer median (${w.targetValue} vs ${w.cohortMedian}). Restrict unauthenticated entry points and public API exposure.`
        );
      } else if (w.metric === 'Security Posture' || w.metric === 'Vulnerability Hygiene') {
        recommendations.push(
          `Vulnerability hygiene is in the ${w.tier.toLowerCase()}. Prioritize resolving the ${targetCritical} critical findings to raise your standing into the top quartile.`
        );
      } else if (w.metric === 'Architecture Stability') {
        recommendations.push(
          `Architecture collapse risk is higher than peer median. Refactor cyclic coupling in core modules to improve resilience.`
        );
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain automated PR gate checks to preserve your top-tier benchmark ranking on future merges.');
  }

  return {
    analysisId: target.id,
    repoUrl: target.repo_url,
    cohortSize: trustPool.length,
    overallPercentile,
    overallTier,
    metrics,
    sizeCohort,
    insights,
    recommendations,
  };
}
