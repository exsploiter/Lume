import type { TrustScoreResult } from '@/types';
import { clampScore } from '@/lib/risk-utils';

export function calculateTrustScore(params: {
  repoSecurityScore: number;
  collapseScore: number;
  exploitabilityScore: number;
  propagationRisk: number;
  blastRadius: number;
  criticalAuthIssues: number;
  architectureRisk: number;
}): TrustScoreResult {
  const raw =
    params.repoSecurityScore * 0.28 +
    (100 - params.collapseScore) * 0.2 +
    (100 - params.exploitabilityScore) * 0.18 +
    (100 - params.propagationRisk) * 0.12 +
    (100 - Math.min(100, params.blastRadius * 3)) * 0.08 +
    (100 - params.architectureRisk) * 0.1 -
    params.criticalAuthIssues * 3;

  const trustScore = Math.round(clampScore(raw, 0, 100) * 10) / 10;
  const recommendation = trustScore >= 80 ? 'SAFE TO SHIP' : trustScore >= 60 ? 'NEEDS REVIEW' : trustScore >= 35 ? 'HIGH RISK' : 'DEPLOYMENT NOT RECOMMENDED';

  return {
    trustScore,
    deploymentConfidence: Math.round(clampScore(trustScore + (100 - params.collapseScore) * 0.2, 0, 100) * 10) / 10,
    operationalStability: Math.round(clampScore((100 - params.collapseScore) * 0.35 + (100 - params.propagationRisk) * 0.25 + (100 - params.architectureRisk) * 0.2, 0, 100) * 10) / 10,
    securityExposure: Math.round(clampScore(params.exploitabilityScore * 0.6 + params.criticalAuthIssues * 12, 0, 100) * 10) / 10,
    architectureHealth: Math.round(clampScore((100 - params.collapseScore) * 0.5 + (100 - Math.min(100, params.blastRadius * 3)) * 0.3, 0, 100) * 10) / 10,
    recommendation,
    reasons: [
      `Security score ${Math.round(params.repoSecurityScore)}`,
      `Collapse pressure ${Math.round(params.collapseScore)}`,
      `Exploitability ${Math.round(params.exploitabilityScore)}`,
    ],
  };
}
