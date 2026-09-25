import { clampScore } from '@/lib/risk-utils';

export function calculateDependencyRisk(params: {
  blastRadius: number;
  vulnerabilityCount: number;
  securityScore: number;
  exploitabilityScore: number;
}): number {
  const risk =
    params.blastRadius * 3 +
    params.vulnerabilityCount * 4 +
    (100 - params.securityScore) * 0.12 +
    params.exploitabilityScore * 0.35;

  return Math.round(clampScore(risk, 0, 100) * 10) / 10;
}
