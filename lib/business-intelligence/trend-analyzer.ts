import type { AnalysisRecord, HistoricalTrendResult, TrendDataPoint } from '@/types';
import { calculateTrustScore } from './trust-score';

export function extractTrendDataPoint(record: AnalysisRecord): TrendDataPoint {
  const repoSecurityScore = record.repo_security_score ?? 0;
  const collapseScore = record.collapse_score ?? 0;
  const repoExploitabilityScore = record.repo_exploitability_score ?? 0;
  const criticalVulnerabilities = record.critical_vulnerabilities ?? 0;
  const totalVulnerabilities = record.security_summary?.totalVulnerabilities ?? criticalVulnerabilities;
  const propagationRisk = record.collapse_prediction?.collapseProbability ?? collapseScore;
  const blastRadius = record.avg_debt_score ? Math.min(30, Math.round(record.avg_debt_score / 3)) : 10;

  const trustResult = calculateTrustScore({
    repoSecurityScore,
    collapseScore,
    exploitabilityScore: repoExploitabilityScore,
    propagationRisk,
    blastRadius,
    criticalAuthIssues: criticalVulnerabilities,
    architectureRisk: collapseScore,
  });

  const trustScore = typeof record.trustScore === 'number' && record.trustScore > 0
    ? record.trustScore
    : trustResult.trustScore;

  const recommendation = record.deploymentRecommendation ?? trustResult.recommendation;

  return {
    analysisId: record.id,
    timestamp: record.created_at || new Date().toISOString(),
    trustScore: Math.round(trustScore * 10) / 10,
    repoSecurityScore: Math.round(repoSecurityScore * 10) / 10,
    collapseScore: Math.round(collapseScore * 10) / 10,
    repoExploitabilityScore: Math.round(repoExploitabilityScore * 10) / 10,
    criticalVulnerabilities,
    totalVulnerabilities,
    avgDebtScore: Math.round((record.avg_debt_score ?? 0) * 10) / 10,
    totalFiles: record.total_files ?? 0,
    totalNodes: record.total_nodes ?? 0,
    recommendation,
  };
}

export function analyzeHistoricalTrend(
  analyses: AnalysisRecord[],
  targetRepoUrl?: string
): HistoricalTrendResult {
  if (!analyses || analyses.length === 0) {
    return {
      repoUrl: targetRepoUrl ?? '',
      repoOwner: '',
      repoName: '',
      totalScans: 0,
      history: [],
      trajectory: 'insufficient_data',
      trustScoreDelta: 0,
      securityScoreDelta: 0,
      criticalVulnDelta: 0,
      exploitabilityDelta: 0,
      summary: 'No historical analysis data found for this repository.',
      insights: ['Run additional scans over time to unlock longitudinal risk tracking.'],
    };
  }

  // Sort chronologically ascending
  const sortedAnalyses = [...analyses].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  const history: TrendDataPoint[] = sortedAnalyses.map(extractTrendDataPoint);
  const latest = history[history.length - 1];
  const primaryRecord = sortedAnalyses[sortedAnalyses.length - 1];
  const repoUrl = targetRepoUrl || primaryRecord.repo_url || '';
  const repoOwner = primaryRecord.repo_owner || '';
  const repoName = primaryRecord.repo_name || '';

  if (history.length === 1) {
    return {
      repoUrl,
      repoOwner,
      repoName,
      totalScans: 1,
      history,
      trajectory: 'insufficient_data',
      trustScoreDelta: 0,
      securityScoreDelta: 0,
      criticalVulnDelta: 0,
      exploitabilityDelta: 0,
      summary: `Baseline analysis established for ${repoOwner ? `${repoOwner}/${repoName}` : 'repository'}. Current Trust Score: ${latest.trustScore}/100.`,
      insights: [
        'First scan recorded. Future scans on pull requests or commits will display trend velocity and regressions.',
        `Current baseline: ${latest.criticalVulnerabilities} critical vulnerabilities, security score ${latest.repoSecurityScore}/100.`,
      ],
    };
  }

  const previous = history[history.length - 2];
  const trustScoreDelta = Math.round((latest.trustScore - previous.trustScore) * 10) / 10;
  const securityScoreDelta = Math.round((latest.repoSecurityScore - previous.repoSecurityScore) * 10) / 10;
  const criticalVulnDelta = latest.criticalVulnerabilities - previous.criticalVulnerabilities;
  const exploitabilityDelta = Math.round((latest.repoExploitabilityScore - previous.repoExploitabilityScore) * 10) / 10;

  // Trajectory classification
  let trajectory: HistoricalTrendResult['trajectory'] = 'stable';
  if (trustScoreDelta >= 3 || (trustScoreDelta >= 0 && criticalVulnDelta < 0)) {
    trajectory = 'improving';
  } else if (trustScoreDelta <= -3 || criticalVulnDelta > 0 || securityScoreDelta <= -5) {
    trajectory = 'degrading';
  }

  // Long-term delta across entire scan history
  const oldest = history[0];
  const totalTrustDelta = Math.round((latest.trustScore - oldest.trustScore) * 10) / 10;
  const totalVulnDelta = latest.criticalVulnerabilities - oldest.criticalVulnerabilities;

  // Generate summary
  let summary = '';
  if (trajectory === 'improving') {
    summary = `Trust Score improved by ${trustScoreDelta >= 0 ? `+${trustScoreDelta}` : trustScoreDelta} pts in the latest scan (${latest.trustScore}/100). Overall change across ${history.length} scans: ${totalTrustDelta >= 0 ? `+${totalTrustDelta}` : totalTrustDelta} pts.`;
  } else if (trajectory === 'degrading') {
    summary = `Risk increased in the latest scan: Trust Score declined by ${trustScoreDelta} pts (${latest.trustScore}/100)${criticalVulnDelta > 0 ? ` with ${criticalVulnDelta} new critical vulnerability` : ''}.`;
  } else {
    summary = `Repository health remains steady at ${latest.trustScore}/100 Trust Score across recent scans.`;
  }

  // Generate actionable insights
  const insights: string[] = [];

  if (criticalVulnDelta < 0) {
    insights.push(`Resolved ${Math.abs(criticalVulnDelta)} critical vulnerability since the previous scan.`);
  } else if (criticalVulnDelta > 0) {
    insights.push(`Warning: ${criticalVulnDelta} new critical vulnerability introduced since previous scan.`);
  }

  if (securityScoreDelta > 5) {
    insights.push(`Security posture strengthened significantly (+${securityScoreDelta} pts).`);
  } else if (securityScoreDelta < -5) {
    insights.push(`Security posture degraded by ${securityScoreDelta} pts.`);
  }

  if (exploitabilityDelta < -3) {
    insights.push(`Attack surface and exploitability decreased by ${Math.abs(exploitabilityDelta)} pts.`);
  } else if (exploitabilityDelta > 3) {
    insights.push(`Exploitability increased (+${exploitabilityDelta} pts), indicating new public exposure or deeper attack paths.`);
  }

  if (history.length >= 3) {
    const avgVelocity = Math.round(((oldest.criticalVulnerabilities - latest.criticalVulnerabilities) / (history.length - 1)) * 10) / 10;
    if (avgVelocity > 0) {
      insights.push(`Remediation velocity: resolving ~${avgVelocity} vulnerabilities per scan cycle.`);
    }
  }

  if (insights.length === 0) {
    insights.push(`Metrics are consistent with previous scan (${previous.recommendation} → ${latest.recommendation}).`);
  }

  return {
    repoUrl,
    repoOwner,
    repoName,
    totalScans: history.length,
    history,
    trajectory,
    trustScoreDelta,
    securityScoreDelta,
    criticalVulnDelta,
    exploitabilityDelta,
    summary,
    insights,
  };
}
