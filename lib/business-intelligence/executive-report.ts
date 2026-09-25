import type { AnalysisRecord, DebtNode } from '@/types';
import { calculateFinancialImpact } from './financial-impact';
import { buildRiskTimeline } from './risk-timeline';
import { calculateComplianceReadinessScore } from './compliance-score';

export interface ExecutiveReport {
  executiveSummary: string[];
  repositoryHealth: string;
  deploymentRecommendation: string;
  topBusinessRisks: string[];
  financialExposure: {
    estimatedFixCost: number;
    estimatedIncidentExposure: number;
    estimatedOperationalExposure: number;
    riskLevel: string;
  };
  complianceSummary: { score: number; grade: string; status: string };
  recommendedActions: string[];
}

export function buildExecutiveReport(params: {
  analysis: AnalysisRecord;
  nodes: DebtNode[];
  trustScore: number;
  deploymentConfidence: number;
}) : ExecutiveReport {
  const { analysis, nodes, trustScore, deploymentConfidence } = params;

  const securityScore = analysis.repo_security_score ?? 0;
  const exploitability = analysis.repo_exploitability_score ?? 0;
  const collapseRisk = analysis.collapse_score ?? 0;
  const criticalCount = analysis.critical_vulnerabilities ?? 0;
  const blastRadius = nodes.length > 0 ? Math.round(nodes.reduce((t, n) => t + (n.blast_radius ?? 0), 0) / nodes.length) : 0;

  const financial = calculateFinancialImpact({
    trustScore,
    securityScore,
    exploitabilityScore: exploitability,
    collapseRisk,
    blastRadius,
    criticalVulnerabilityCount: criticalCount,
    deploymentConfidence,
  });

  const timeline = buildRiskTimeline({
    trustScore,
    securityScore,
    exploitabilityScore: exploitability,
    collapseRisk,
    criticalVulnerabilityCount: criticalCount,
    deploymentConfidence,
  });

  const compliance = calculateComplianceReadinessScore({
    securityFindings: nodes.flatMap((n) => n.security_findings ?? []),
    vulnerabilityCount: nodes.reduce((s, n) => s + (n.vulnerability_count ?? 0), 0),
    exploitabilityScore: exploitability,
    trustScore,
    deploymentConfidence,
    criticalVulnerabilityCount: criticalCount,
  });

  const topBusinessRisks = (analysis.businessRisks && analysis.businessRisks.length > 0)
    ? analysis.businessRisks.slice(0, 5)
    : nodes
        .flatMap((n) => n.owasp_categories ?? [])
        .slice(0, 5);

  const repoHealth = `Security score ${securityScore}/100 · Debt avg ${Math.round(analysis.avg_debt_score || 0)} · Collapse risk ${Math.round(collapseRisk)}%`;

  const executiveSummary = [] as string[];
  if (analysis.executiveSummary) {
    // split into paragraphs but cap to 4
    const paras = analysis.executiveSummary.split('\n\n').slice(0, 4);
    for (const p of paras) executiveSummary.push(p.trim());
  } else {
    executiveSummary.push(`The repository demonstrates a generally ${securityScore >= 70 ? 'healthy' : 'fragile'} software posture.`);
    executiveSummary.push(`Key risk drivers include ${topBusinessRisks.slice(0,3).join(', ') || 'security and architectural exposure'}.`);
    executiveSummary.push(`Estimated short-term financial exposure is ${financial.riskLevel.toLowerCase()} and should be considered in release planning.`);
    executiveSummary.push(`Recommend prioritizing remediation to reduce critical vulnerability exposure and improve deployment readiness.`);
  }

  const recommendedActions = [
    'Resolve authentication-related risks and critical vulnerabilities.',
    'Reduce critical vulnerability exposure and patch high-impact findings.',
    'Improve deployment readiness and re-run the pre-release security checks before production.'
  ];

  return {
    executiveSummary: executiveSummary.slice(0, 4),
    repositoryHealth: repoHealth,
    deploymentRecommendation: analysis.deploymentRecommendation ?? (deploymentConfidence >= 70 ? 'SAFE TO SHIP' : 'NEEDS REVIEW'),
    topBusinessRisks: topBusinessRisks.slice(0, 5),
    financialExposure: {
      estimatedFixCost: financial.estimatedFixCost,
      estimatedIncidentExposure: financial.estimatedIncidentExposure,
      estimatedOperationalExposure: financial.estimatedOperationalExposure,
      riskLevel: financial.riskLevel,
    },
    complianceSummary: { score: compliance.score, grade: compliance.grade, status: compliance.status },
    recommendedActions: recommendedActions.slice(0, 3),
  };
}

export default buildExecutiveReport;
