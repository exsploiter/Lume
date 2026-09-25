import type { AnalysisRecord, DebtNode, SecurityFinding } from '@/types';
import { calculateComplianceReadinessScore } from '@/lib/business-intelligence/compliance-score';

export type ComplianceRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface ComplianceCategoryExposure {
  framework: 'OWASP' | 'CERT-In' | 'DPDP' | 'Security Governance';
  exposure: 'Potential Exposure' | 'Potential Risk' | 'Potential Impact';
  risk: ComplianceRiskLevel;
  impact: string;
}

export interface ComplianceRiskResult {
  complianceReadinessScore: number;
  overallRisk: ComplianceRiskLevel;
  complianceCategories: ComplianceCategoryExposure[];
  criticalComplianceRisks: string[];
  recommendations: string[];
  readinessGrade: 'Excellent' | 'Strong' | 'Moderate' | 'Needs Improvement' | 'High Risk';
  readinessStatus: string;
}

const FRAMEWORK_RULES = [
  {
    framework: 'CERT-In' as const,
    exposure: 'Potential Risk' as const,
    keywords: ['secret', 'hardcoded secret', 'credential', 'token', 'api key', 'sql injection', 'command injection', 'xss', 'csrf', 'sensitive data'],
    impact: 'Operational exposure and incident handling burden may increase.',
  },
  {
    framework: 'DPDP' as const,
    exposure: 'Potential Impact' as const,
    keywords: ['authentication bypass', 'weak authentication', 'sensitive data', 'personal data', 'data exposure', 'session', 'authorization', 'privacy'],
    impact: 'Customer data handling and privacy controls may face elevated exposure.',
  },
  {
    framework: 'Security Governance' as const,
    exposure: 'Potential Exposure' as const,
    keywords: ['secret', 'authentication bypass', 'weak authentication', 'policy', 'access control', 'privilege', 'governance', 'audit'],
    impact: 'Audit readiness and control assurance may be reduced.',
  },
  {
    framework: 'OWASP' as const,
    exposure: 'Potential Exposure' as const,
    keywords: ['sql injection', 'xss', 'command injection', 'authentication bypass', 'weak authentication', 'exposed secrets', 'csrf'],
    impact: 'Application threat posture maps to common web application exposure patterns.',
  },
];

export function buildComplianceRisk(params: {
  analysis: AnalysisRecord;
  nodes: DebtNode[];
}): ComplianceRiskResult {
  const findings = params.nodes.flatMap((node) => node.security_findings ?? []);
  const normalizedText = findings.map((finding) => `${finding.title} ${finding.description} ${finding.category} ${finding.recommendation}`.toLowerCase());
  const criticalCount = params.analysis.critical_vulnerabilities ?? findings.filter((finding) => finding.severity === 'critical').length;
  const vulnerabilityCount = params.analysis.security_summary?.totalVulnerabilities ?? findings.length;
  const trustScore = params.analysis.trustScore ?? params.analysis.repo_security_score ?? 0;
  const deploymentConfidence = params.analysis.deploymentConfidence ?? 0;
  const exploitabilityScore = params.analysis.repo_exploitability_score ?? 0;
  const collapseRisk = params.analysis.collapse_prediction?.collapseProbability ?? params.analysis.collapse_score ?? 0;

  const readiness = calculateComplianceReadinessScore({
    securityFindings: findings,
    vulnerabilityCount,
    exploitabilityScore,
    trustScore,
    deploymentConfidence,
    criticalVulnerabilityCount: criticalCount,
  });

  const matchedCategories = FRAMEWORK_RULES.flatMap((rule) => {
    const matched = rule.keywords.some((keyword) => normalizedText.some((text) => text.includes(keyword)));
    if (!matched) return [];

    return [{
      framework: rule.framework,
      exposure: rule.exposure,
      risk: determineRiskLevel({
        criticalCount,
        vulnerabilityCount,
        exploitabilityScore,
        collapseRisk,
        framework: rule.framework,
      }),
      impact: rule.impact,
    }];
  });

  const complianceCategories = matchedCategories.length > 0
    ? matchedCategories
    : [{
        framework: 'Security Governance' as const,
        exposure: 'Potential Exposure' as const,
        risk: determineRiskLevel({
          criticalCount,
          vulnerabilityCount,
          exploitabilityScore,
          collapseRisk,
          framework: 'Security Governance',
        }),
        impact: 'Baseline governance exposure is present wherever unresolved security findings remain.',
      }];

  const overallRisk = determineOverallRisk({
    readinessScore: readiness.score,
    criticalCount,
    exploitabilityScore,
    collapseRisk,
    vulnerabilityCount,
  });

  const criticalComplianceRisks = buildCriticalRisks(params.analysis, findings, complianceCategories);
  const recommendations = buildRecommendations({
    findings,
    criticalCount,
    categories: complianceCategories,
    readinessScore: readiness.score,
    exploitabilityScore,
    collapseRisk,
    trustScore,
    deploymentConfidence,
  });

  return {
    complianceReadinessScore: readiness.score,
    overallRisk,
    complianceCategories,
    criticalComplianceRisks,
    recommendations,
    readinessGrade: readiness.grade,
    readinessStatus: readiness.status,
  };
}

function determineRiskLevel(params: {
  criticalCount: number;
  vulnerabilityCount: number;
  exploitabilityScore: number;
  collapseRisk: number;
  framework: string;
}): ComplianceRiskLevel {
  const score =
    params.criticalCount * 12 +
    params.vulnerabilityCount * 0.8 +
    params.exploitabilityScore * 0.22 +
    params.collapseRisk * 0.18 +
    (params.framework === 'DPDP' ? 4 : 0);

  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

function determineOverallRisk(params: {
  readinessScore: number;
  criticalCount: number;
  exploitabilityScore: number;
  collapseRisk: number;
  vulnerabilityCount: number;
}): ComplianceRiskLevel {
  const riskScore =
    (100 - params.readinessScore) * 0.6 +
    params.criticalCount * 10 +
    params.exploitabilityScore * 0.18 +
    params.collapseRisk * 0.14 +
    params.vulnerabilityCount * 0.4;

  if (riskScore >= 80) return 'CRITICAL';
  if (riskScore >= 55) return 'HIGH';
  if (riskScore >= 30) return 'MODERATE';
  return 'LOW';
}

function buildCriticalRisks(analysis: AnalysisRecord, findings: SecurityFinding[], categories: ComplianceCategoryExposure[]): string[] {
  const riskList = [
    ...findings
      .filter((finding) => finding.severity === 'critical' || finding.category === 'Secrets' || /auth|privacy|personal data|sql injection/i.test(finding.title))
      .map((finding) => `${finding.title} in ${finding.filePath}`),
    ...categories.filter((category) => category.risk === 'CRITICAL' || category.risk === 'HIGH').map((category) => `${category.framework} requires attention`),
    analysis.critical_vulnerabilities > 0 ? `${analysis.critical_vulnerabilities} critical security findings require review` : '',
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(riskList)).slice(0, 5);
}

function buildRecommendations(params: {
  findings: SecurityFinding[];
  criticalCount: number;
  categories: ComplianceCategoryExposure[];
  readinessScore: number;
  exploitabilityScore: number;
  collapseRisk: number;
  trustScore: number;
  deploymentConfidence: number;
}): string[] {
  const recommendations = new Set<string>();

  if (params.findings.some((finding) => /secret|credential|token|api key/i.test(finding.title + ' ' + finding.description))) {
    recommendations.add('Reduce exposed secrets.');
  }

  if (params.findings.some((finding) => /auth|authentication|authorization|session/i.test(finding.title + ' ' + finding.description))) {
    recommendations.add('Strengthen authentication controls.');
  }

  if (params.criticalCount > 0 || params.readinessScore < 70) {
    recommendations.add('Address critical vulnerabilities before deployment.');
  }

  if (params.categories.some((category) => category.framework === 'DPDP')) {
    recommendations.add('Review customer data handling paths.');
  }

  if (params.exploitabilityScore >= 60) {
    recommendations.add('Limit externally reachable attack surfaces.');
  }

  if (params.collapseRisk >= 60) {
    recommendations.add('Stabilize fragile control paths that may affect governance and audit readiness.');
  }

  if (params.trustScore < 70 || params.deploymentConfidence < 70) {
    recommendations.add('Reassess release readiness after remediation completes.');
  }

  if (recommendations.size === 0) {
    recommendations.add('Maintain current governance controls and continue monitoring identified exposure.');
  }

  return Array.from(recommendations).slice(0, 5);
}