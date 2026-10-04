import type { AnalysisRecord, SecurityFinding } from '@/types';
import { calculateTrustScore } from '@/lib/business-intelligence/trust-score';

export interface CiGateConfig {
  minTrustScore?: number; // default: 60
  maxCriticalVulns?: number; // default: 0
  maxExploitabilityScore?: number; // default: 70
  failOnCollapse?: boolean; // default: true
  minDeploymentConfidence?: number; // default: 65
}

export interface CiGateResult {
  passed: boolean;
  verdict: 'PASSED' | 'FAILED';
  state: 'success' | 'failure';
  trustScore: number;
  criticalVulnerabilities: number;
  exploitabilityScore: number;
  collapsePredicted: boolean;
  deploymentConfidence: number;
  reasons: string[];
  summaryText: string;
  markdownReport: string;
}

export const DEFAULT_CI_GATE_CONFIG: Required<CiGateConfig> = {
  minTrustScore: 60,
  maxCriticalVulns: 0,
  maxExploitabilityScore: 70,
  failOnCollapse: true,
  minDeploymentConfidence: 65,
};

/**
 * Evaluates whether an analysis result meets the CI/CD Quality and Security Gate thresholds.
 */
export function evaluateCiGate(
  analysis: AnalysisRecord,
  customConfig?: CiGateConfig,
  metadata?: {
    owner: string;
    repo: string;
    commitSha?: string;
    prNumber?: number;
    appUrl?: string;
  }
): CiGateResult {
  const config = { ...DEFAULT_CI_GATE_CONFIG, ...customConfig };

  // 1. Calculate Trust & Confidence Metrics
  let trustScore = analysis.trustScore ?? 0;
  let deploymentConfidence = analysis.deploymentConfidence ?? 0;

  if (!trustScore) {
    const calculated = calculateTrustScore({
      repoSecurityScore: analysis.repo_security_score ?? 70,
      collapseScore: analysis.collapse_score ?? 30,
      exploitabilityScore: analysis.repo_exploitability_score ?? 20,
      propagationRisk: analysis.attack_graph?.propagationRisk ?? 20,
      blastRadius: 5,
      criticalAuthIssues: analysis.critical_vulnerabilities ?? 0,
      architectureRisk: analysis.avg_debt_score ? Math.min(100, analysis.avg_debt_score * 1.5) : 30,
    });
    trustScore = calculated.trustScore;
    deploymentConfidence = calculated.deploymentConfidence;
  }

  const criticalVulns = analysis.critical_vulnerabilities ?? 0;
  const exploitability = analysis.repo_exploitability_score ?? 0;
  const isCollapsed = Boolean(analysis.security_collapse || (analysis.collapse_score ?? 0) >= 75);

  // 2. Evaluate Blockers
  const reasons: string[] = [];

  if (criticalVulns > config.maxCriticalVulns) {
    reasons.push(
      `Detected ${criticalVulns} critical ${criticalVulns === 1 ? 'vulnerability' : 'vulnerabilities'} (max allowed: ${config.maxCriticalVulns})`
    );
  }

  if (isCollapsed && config.failOnCollapse) {
    reasons.push('High architectural collapse risk predicted for this codebase');
  }

  if (trustScore < config.minTrustScore) {
    reasons.push(`Trust Score (${trustScore}/100) is below the minimum required threshold of ${config.minTrustScore}/100`);
  }

  if (exploitability > config.maxExploitabilityScore) {
    reasons.push(`Exploitability score (${exploitability}/100) exceeds maximum acceptable threshold of ${config.maxExploitabilityScore}/100`);
  }

  if (deploymentConfidence < config.minDeploymentConfidence) {
    reasons.push(`Deployment confidence (${deploymentConfidence}%) is below required threshold of ${config.minDeploymentConfidence}%`);
  }

  const passed = reasons.length === 0;
  const verdict = passed ? 'PASSED' : 'FAILED';
  const state = passed ? 'success' : 'failure';

  const summaryText = passed
    ? `DebtRadar Gate PASSED: Trust Score ${trustScore}/100, 0 critical exploits.`
    : `DebtRadar Gate FAILED: ${reasons[0] || 'Quality thresholds not met.'}`;

  // 3. Generate Markdown Report for PR comments and Check Runs
  const baseUrl = metadata?.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://debtradar.dev';
  const dashboardUrl = `${baseUrl}/repo/${metadata?.owner || analysis.repo_owner}/${metadata?.repo || analysis.repo_name}?id=${analysis.id}`;

  const topFindings: SecurityFinding[] = analysis.security_summary?.topFindings || [];
  const criticalFindings = topFindings.filter((f) => f.severity === 'critical');

  const statusBadge = passed ? '🟢 **PASSED**' : '🔴 **FAILED**';
  const collapseBadge = isCollapsed ? '⚠️ **CRITICAL**' : '✅ **STABLE**';

  let markdownReport = `### ${passed ? '🛡️' : '🚨'} DebtRadar Risk & Quality Gate — ${statusBadge}\n\n`;
  markdownReport += `Automated architecture health and security verification for commit \`${metadata?.commitSha ? metadata.commitSha.slice(0, 7) : 'HEAD'}\`.\n\n`;

  markdownReport += `| Metric | Current Value | Gate Threshold | Status |\n`;
  markdownReport += `| :--- | :--- | :--- | :--- |\n`;
  markdownReport += `| **Trust Score** | \`${trustScore} / 100\` | \`≥ ${config.minTrustScore}\` | ${trustScore >= config.minTrustScore ? '✅ Passed' : '❌ Failed'} |\n`;
  markdownReport += `| **Critical Vulnerabilities** | \`${criticalVulns}\` | \`≤ ${config.maxCriticalVulns}\` | ${criticalVulns <= config.maxCriticalVulns ? '✅ Passed' : '❌ Failed'} |\n`;
  markdownReport += `| **Collapse Risk** | ${collapseBadge} | \`Non-collapsing\` | ${!isCollapsed ? '✅ Passed' : '❌ Failed'} |\n`;
  markdownReport += `| **Exploitability Exposure** | \`${exploitability} / 100\` | \`≤ ${config.maxExploitabilityScore}\` | ${exploitability <= config.maxExploitabilityScore ? '✅ Passed' : '❌ Failed'} |\n`;
  markdownReport += `| **Deployment Confidence** | \`${deploymentConfidence}%\` | \`≥ ${config.minDeploymentConfidence}%\` | ${deploymentConfidence >= config.minDeploymentConfidence ? '✅ Passed' : '❌ Failed'} |\n\n`;

  if (!passed) {
    markdownReport += `#### ⚠️ Quality Gate Violations\n`;
    for (const r of reasons) {
      markdownReport += `- ❌ **${r}**\n`;
    }
    markdownReport += `\n`;
  }

  if (criticalFindings.length > 0) {
    markdownReport += `#### 🚨 Critical Findings Requiring Attention\n`;
    markdownReport += `| Finding | File | Location | Autofix |\n`;
    markdownReport += `| :--- | :--- | :--- | :--- |\n`;
    for (const f of criticalFindings.slice(0, 5)) {
      markdownReport += `| **${f.title}** | \`${f.filePath}\` | L${f.lineStart}–L${f.lineEnd} | Available |\n`;
    }
    markdownReport += `\n`;
  }

  markdownReport += `👉 **[View Full DebtRadar Architecture & Attack Graph Dashboard](${dashboardUrl})**\n`;

  return {
    passed,
    verdict,
    state,
    trustScore,
    criticalVulnerabilities: criticalVulns,
    exploitabilityScore: exploitability,
    collapsePredicted: isCollapsed,
    deploymentConfidence,
    reasons,
    summaryText,
    markdownReport,
  };
}
