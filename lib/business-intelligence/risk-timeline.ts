import { clampScore } from '@/lib/risk-utils';

export type RiskTimelineSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskTimelineMilestone {
  statement: string;
  severity: RiskTimelineSeverity;
}

export interface RiskTimelineResult {
  today: RiskTimelineMilestone;
  day30: RiskTimelineMilestone;
  day60: RiskTimelineMilestone;
  day90: RiskTimelineMilestone;
}

export function buildRiskTimeline(params: {
  trustScore: number;
  securityScore: number;
  exploitabilityScore: number;
  collapseRisk: number;
  criticalVulnerabilityCount: number;
  deploymentConfidence: number;
}): RiskTimelineResult {
  const baseScore = clampScore(
    (100 - params.trustScore) * 0.26 +
      (100 - params.securityScore) * 0.18 +
      params.exploitabilityScore * 0.24 +
      params.collapseRisk * 0.24 +
      params.criticalVulnerabilityCount * 7 +
      (100 - params.deploymentConfidence) * 0.16,
    0,
    100
  );

  return {
    today: buildMilestone(baseScore, 0, 'Moderate operational risk.'),
    day30: buildMilestone(baseScore, 12, 'Growing dependency fragility.'),
    day60: buildMilestone(baseScore, 26, 'Elevated service disruption probability.'),
    day90: buildMilestone(baseScore, 40, 'High deployment instability risk.'),
  };
}

function buildMilestone(baseScore: number, offset: number, fallback: string): RiskTimelineMilestone {
  const score = clampScore(baseScore + offset, 0, 100);

  return {
    statement: buildStatement(score, fallback),
    severity: score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW',
  };
}

function buildStatement(score: number, fallback: string): string {
  if (score >= 80) {
    return 'High likelihood of production disruption.';
  }

  if (score >= 60) {
    return 'Incident probability rises as issues compound.';
  }

  if (score >= 35) {
    return 'Operational complexity increases and release confidence weakens.';
  }

  return fallback;
}