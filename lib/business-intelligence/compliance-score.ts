import type { SecurityFinding } from '@/types';
import { clampScore } from '@/lib/risk-utils';

export interface ComplianceReadinessResult {
  score: number;
  grade: 'Excellent' | 'Strong' | 'Moderate' | 'Needs Improvement' | 'High Risk';
  status: string;
}

export function calculateComplianceReadinessScore(params: {
  securityFindings: SecurityFinding[];
  vulnerabilityCount: number;
  exploitabilityScore: number;
  trustScore: number;
  deploymentConfidence: number;
  criticalVulnerabilityCount: number;
}): ComplianceReadinessResult {
  const penalty =
    params.vulnerabilityCount * 1.8 +
    params.criticalVulnerabilityCount * 8 +
    params.exploitabilityScore * 0.18 +
    (100 - params.trustScore) * 0.22 +
    (100 - params.deploymentConfidence) * 0.16 +
    params.securityFindings.filter((finding) => finding.severity === 'critical').length * 3.5;

  const score = Math.round(clampScore(100 - penalty, 0, 100));

  const grade =
    score >= 95 ? 'Excellent' :
    score >= 85 ? 'Strong' :
    score >= 70 ? 'Moderate' :
    score >= 50 ? 'Needs Improvement' : 'High Risk';

  const status =
    grade === 'Excellent'
      ? 'Repository demonstrates strong governance posture with minimal compliance friction.'
      : grade === 'Strong'
        ? 'Repository demonstrates acceptable governance posture but requires remediation of several identified risks.'
        : grade === 'Moderate'
          ? 'Repository is workable but needs targeted compliance remediation before executive review.'
          : grade === 'Needs Improvement'
            ? 'Repository shows governance gaps that should be addressed before release readiness improves.'
            : 'Repository presents material compliance risk and requires immediate remediation focus.';

  return { score, grade, status };
}