import { clampScore } from '@/lib/risk-utils';

export function calculateCollapseScore(params: {
  repoSecurityScore: number;
  repoExploitabilityScore: number;
  criticalVulnerabilities: number;
  propagationRisk: number;
  averageBlastRadius: number;
  instabilityDrivers: number;
}): number {
  const raw =
    (100 - params.repoSecurityScore) * 0.28 +
    params.repoExploitabilityScore * 0.24 +
    Math.min(params.criticalVulnerabilities * 8, 32) +
    params.propagationRisk * 0.18 +
    Math.min(params.averageBlastRadius * 3, 18) +
    Math.min(params.instabilityDrivers * 7, 28);

  return Math.round(clampScore(raw, 0, 100) * 10) / 10;
}
