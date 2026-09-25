import { clampScore } from '@/lib/risk-utils';

export interface SoftwareCreditRatingResult {
  rating: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C' | 'D' | 'F';
  outlook: 'Positive Outlook' | 'Stable Outlook' | 'Negative Outlook' | 'Watchlist';
  explanation: string;
  score: number;
}

export function calculateSoftwareCreditRating(params: {
  trustScore: number;
  deploymentConfidence: number;
  exploitabilityScore: number;
  collapseRisk: number;
  criticalVulnerabilityCount: number;
}): SoftwareCreditRatingResult {
  const composite = clampScore(
    params.trustScore * 0.42 +
      params.deploymentConfidence * 0.24 +
      (100 - params.exploitabilityScore) * 0.16 +
      (100 - params.collapseRisk) * 0.12 -
      params.criticalVulnerabilityCount * 4,
    0,
    100
  );

  const score = Math.round(composite * 10) / 10;

  const rating =
    score >= 95 ? 'A+' :
    score >= 90 ? 'A' :
    score >= 85 ? 'A-' :
    score >= 80 ? 'B+' :
    score >= 75 ? 'B' :
    score >= 70 ? 'B-' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  const outlook =
    rating === 'A+' || rating === 'A' ? 'Positive Outlook' :
    rating === 'A-' || rating === 'B+' || rating === 'B' || rating === 'B-' ? 'Stable Outlook' :
    rating === 'C' ? 'Watchlist' : 'Negative Outlook';

  const explanation = buildExplanation({
    rating,
    trustScore: params.trustScore,
    deploymentConfidence: params.deploymentConfidence,
    exploitabilityScore: params.exploitabilityScore,
    collapseRisk: params.collapseRisk,
    criticalVulnerabilityCount: params.criticalVulnerabilityCount,
  });

  return {
    rating,
    outlook,
    explanation,
    score,
  };
}

function buildExplanation(params: {
  rating: SoftwareCreditRatingResult['rating'];
  trustScore: number;
  deploymentConfidence: number;
  exploitabilityScore: number;
  collapseRisk: number;
  criticalVulnerabilityCount: number;
}): string {
  if (params.rating === 'A+' || params.rating === 'A') {
    return 'Repository health is strong with limited executive risk and a clear path to safe delivery.';
  }

  if (params.rating === 'A-' || params.rating === 'B+' || params.rating === 'B' || params.rating === 'B-') {
    return 'Repository shows moderate risk exposure but remains deployable with targeted remediation.';
  }

  if (params.rating === 'C') {
    return 'Repository is at elevated risk and should be watched closely before a release decision.';
  }

  if (params.criticalVulnerabilityCount > 0 || params.collapseRisk >= 70) {
    return 'Critical issues and structural risk are reducing executive confidence and should be addressed before shipping.';
  }

  if (params.exploitabilityScore >= 65 || params.deploymentConfidence < 50) {
    return 'The repository has meaningful exposure and requires immediate review before release.';
  }

  return `Trust ${Math.round(params.trustScore)}/100 and deployment confidence ${Math.round(params.deploymentConfidence)}/100 indicate limited executive headroom.`;
}