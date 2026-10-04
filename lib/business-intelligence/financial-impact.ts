import { clampScore } from '@/lib/risk-utils';
import { ORG_PROFILES, type OrgRiskProfile } from './methodology';

export interface FinancialImpactResult {
  estimatedFixCost: number;
  estimatedIncidentExposure: number;
  estimatedOperationalExposure: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  methodologyBasis: string;
}

export function calculateFinancialImpact(
  params: {
    trustScore: number;
    securityScore: number;
    exploitabilityScore: number;
    collapseRisk: number;
    blastRadius: number;
    criticalVulnerabilityCount: number;
    deploymentConfidence: number;
  },
  profile: OrgRiskProfile = 'standard'
): FinancialImpactResult {
  const org = ORG_PROFILES[profile] || ORG_PROFILES.standard;

  // 1. Engineering Remediation Cost
  // Based on senior engineering hours required per vulnerability category
  // Critical vuln = ~24 hrs; High blast radius subsystem = ~16 hrs; Architecture debt cleanup = ~8 hrs
  const estimatedHours =
    params.criticalVulnerabilityCount * 24 +
    Math.round((params.blastRadius || 1) * 3) +
    Math.round((100 - params.securityScore) * 0.15) +
    Math.round(params.collapseRisk * 0.2);

  const fixCost = Math.max(25000, estimatedHours * org.hourlyRemediationRateINR);

  // 2. Empirical Incident Breach Exposure
  // Scaled from IBM Cost of a Data Breach India Benchmark (₹17.90 Cr baseline)
  // Weighted by exploitability probability and critical attack chains
  const exploitabilityFactor = Math.min(1.0, (params.exploitabilityScore / 100) * 0.45 + (params.criticalVulnerabilityCount > 0 ? 0.35 : 0.05));
  const blastRadiusFactor = Math.min(1.0, (params.blastRadius / 20) * 0.2);
  const incidentExposure = Math.round(
    org.citableBreachBaselineINR * (exploitabilityFactor + blastRadiusFactor) * 0.08 +
    params.criticalVulnerabilityCount * 250000 +
    params.exploitabilityScore * 15000
  );

  // 3. Operational Outage Exposure (SLA penalties & downtime)
  const operationalExposure = Math.round(
    params.collapseRisk * 12500 +
    (100 - params.deploymentConfidence) * 6500 +
    params.blastRadius * 18000 +
    50000
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
    riskScore >= 80 || incidentExposure >= 5000000 || operationalExposure >= 1500000
      ? 'CRITICAL'
      : riskScore >= 60 || incidentExposure >= 1500000 || operationalExposure >= 600000
        ? 'HIGH'
        : riskScore >= 35 || incidentExposure >= 500000 || operationalExposure >= 200000
          ? 'MEDIUM'
          : 'LOW';

  return {
    estimatedFixCost: fixCost,
    estimatedIncidentExposure: incidentExposure,
    estimatedOperationalExposure: operationalExposure,
    riskLevel,
    methodologyBasis: `Calibrated against IBM Cost of a Data Breach (₹17.9Cr benchmark) & ₹${org.hourlyRemediationRateINR.toLocaleString('en-IN')}/hr engineering rate.`,
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