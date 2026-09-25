import type { ConsequencePredictionResult } from '@/types';
import { clampScore } from '@/lib/risk-utils';

export function predictConsequences(params: {
  vulnerabilityType: string;
  exploitabilityScore: number;
  blastRadius: number;
  systemCriticality: number;
  architectureRisk: number;
}): ConsequencePredictionResult {
  const severityScore = clampScore(
    params.exploitabilityScore * 0.35 +
      params.blastRadius * 5 +
      params.systemCriticality * 0.25 +
      params.architectureRisk * 0.2,
    0,
    100
  );

  const estimatedSeverity = severityScore >= 80 ? 'CRITICAL' : severityScore >= 60 ? 'HIGH' : severityScore >= 35 ? 'MEDIUM' : 'LOW';
  const likelyFailureScenarios = [
    params.vulnerabilityType.toLowerCase().includes('auth') ? 'authentication bypass' : 'production instability',
    params.vulnerabilityType.toLowerCase().includes('payment') ? 'payment system disruption' : 'service outage',
    params.blastRadius >= 6 ? 'cascading service failure' : 'localized incident',
    params.exploitabilityScore >= 70 ? 'customer data exposure' : 'operational slowdown',
  ];

  return {
    shortTermImpact: estimatedSeverity === 'CRITICAL' ? 'Immediate production incidents are likely if this is deployed unchanged.' : 'This issue may cause user-facing instability soon after release.',
    longTermImpact: 'If ignored, maintenance cost, incident frequency, and trust erosion will likely increase.',
    productionRisk: params.blastRadius >= 6 ? 'High chance of cascading production failures.' : 'Moderate production risk that still warrants review.',
    customerRisk: params.exploitabilityScore >= 60 ? 'Customers may face exposure, downtime, or failed workflows.' : 'Customers may experience localized degradation.',
    scalabilityImpact: params.architectureRisk >= 60 ? 'Scaling and future feature delivery may slow down materially.' : 'Scaling may remain possible but with added fragility.',
    estimatedSeverity,
    likelyFailureScenarios,
  };
}
