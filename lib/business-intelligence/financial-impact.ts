import { clampScore } from '@/lib/risk-utils';

export interface FinancialImpactResult {
  estimatedFixCost: number;
  estimatedIncidentExposure: number;
  estimatedOperationalExposure: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function calculateFinancialImpact(params: {
  trustScore: number;
  securityScore: number;
  exploitabilityScore: number;
  collapseRisk: number;
  blastRadius: number;
  criticalVulnerabilityCount: number;
  deploymentConfidence: number;
}): FinancialImpactResult {
  const fixCost = Math.round(
    25000 +
      params.criticalVulnerabilityCount * 18000 +
      params.collapseRisk * 520 +
      (100 - params.securityScore) * 240 +
      (100 - params.trustScore) * 140 +
      params.blastRadius * 2600
  );

  const incidentExposure = Math.round(
    40000 +
      params.criticalVulnerabilityCount * 85000 +
      params.exploitabilityScore * 9000 +
      params.blastRadius * 15000 +
      (100 - params.securityScore) * 1800
  );

  const operationalExposure = Math.round(
    30000 +
      params.collapseRisk * 6500 +
      (100 - params.deploymentConfidence) * 3200 +
      params.exploitabilityScore * 1700 +
      params.blastRadius * 9000
  );

  const riskScore = clampScore(
    params.criticalVulnerabilityCount * 14 +
      params.exploitabilityScore * 0.32 +
      params.collapseRisk * 0.3 +
      (100 - params.deploymentConfidence) * 0.18 +
      (100 - params.trustScore) * 0.1,
    0,
    100
  );

  const riskLevel =
    riskScore >= 80 || incidentExposure >= 1500000 || operationalExposure >= 900000
      ? 'CRITICAL'
      : riskScore >= 60 || incidentExposure >= 700000 || operationalExposure >= 400000
        ? 'HIGH'
        : riskScore >= 35 || incidentExposure >= 200000 || operationalExposure >= 150000
          ? 'MEDIUM'
          : 'LOW';

  return {
    estimatedFixCost: fixCost,
    estimatedIncidentExposure: incidentExposure,
    estimatedOperationalExposure: operationalExposure,
    riskLevel,
  };
}

export function formatIndianCurrency(amount: number): string {
  const rounded = Math.max(0, Math.round(amount));

  if (rounded >= 10000000) {
    return `₹${formatCompact(rounded / 10000000)} Crores`;
  }

  if (rounded >= 100000) {
    return `₹${formatCompact(rounded / 100000)} Lakhs`;
  }

  return `₹${new Intl.NumberFormat('en-IN').format(rounded)}`;
}

function formatCompact(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}