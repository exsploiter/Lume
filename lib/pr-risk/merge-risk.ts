import { clampScore } from '@/lib/risk-utils';

export function scoreMergeRisk(params: {
  touchedCriticalFiles: number;
  securityRegression: boolean;
  newVulnerabilities: number;
  architectureImpact: number;
  unstableChanges: number;
}): { mergeRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; score: number } {
  const score = clampScore(
    params.touchedCriticalFiles * 18 +
      (params.securityRegression ? 25 : 0) +
      params.newVulnerabilities * 7 +
      params.architectureImpact * 5 +
      params.unstableChanges * 4,
    0,
    100
  );

  const mergeRisk = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  return { mergeRisk, score: Math.round(score * 10) / 10 };
}
