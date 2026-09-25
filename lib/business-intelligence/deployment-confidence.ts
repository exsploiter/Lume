import type { DeploymentConfidenceResult } from '@/types';
import { clampScore } from '@/lib/risk-utils';

export function calculateDeploymentConfidence(params: {
  repoSecurityScore: number;
  trustScore: number;
  collapseScore: number;
  exploitabilityScore: number;
  propagationRisk: number;
  criticalAuthIssues: number;
}): DeploymentConfidenceResult {
  const confidence = clampScore(
    params.repoSecurityScore * 0.22 +
      params.trustScore * 0.3 +
      (100 - params.collapseScore) * 0.18 +
      (100 - params.exploitabilityScore) * 0.15 +
      (100 - params.propagationRisk) * 0.1 -
      params.criticalAuthIssues * 4,
    0,
    100
  );

  const deploymentRecommendation = confidence >= 80 ? 'SAFE TO SHIP' : confidence >= 60 ? 'NEEDS REVIEW' : confidence >= 35 ? 'HIGH RISK' : 'DEPLOYMENT NOT RECOMMENDED';

  return {
    deploymentConfidence: Math.round(confidence * 10) / 10,
    deploymentRecommendation,
    productionReadiness: deploymentRecommendation === 'SAFE TO SHIP' ? 'Production readiness is strong.' : 'Production readiness requires attention before release.',
    customerRiskLevel: confidence >= 80 ? 'Low customer risk' : confidence >= 60 ? 'Moderate customer risk' : 'High customer risk',
    operationalStability: confidence >= 75 ? 'Stable' : confidence >= 50 ? 'Mixed' : 'Unstable',
    securityExposure: params.exploitabilityScore >= 65 ? 'Elevated security exposure' : 'Controlled security exposure',
    architectureHealth: params.collapseScore >= 70 ? 'Architecture under stress' : 'Architecture acceptable',
    factors: [
      `Trust score ${Math.round(params.trustScore)}`,
      `Collapse score ${Math.round(params.collapseScore)}`,
      `Exploitability ${Math.round(params.exploitabilityScore)}`,
      `Propagation risk ${Math.round(params.propagationRisk)}`,
    ],
  };
}
