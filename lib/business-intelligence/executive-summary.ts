import type { BusinessTranslationResult, ConsequencePredictionResult, DeploymentConfidenceResult, TrustScoreResult } from '@/types';

export function buildExecutiveSummary(params: {
  repoName: string;
  trustScore: TrustScoreResult;
  deploymentConfidence: DeploymentConfidenceResult;
  translations: BusinessTranslationResult[];
  consequences: ConsequencePredictionResult[];
}): string {
  const topTranslation = params.translations[0];
  const topConsequence = params.consequences[0];

  return [
    `${params.repoName} is currently positioned as ${params.trustScore.recommendation.toLowerCase()}.`,
    topTranslation ? `Primary business concern: ${topTranslation.businessImpact}` : '',
    topConsequence ? `If ignored: ${topConsequence.shortTermImpact}` : '',
    `Deployment confidence is ${params.deploymentConfidence.deploymentConfidence}/100 and the system is ${params.deploymentConfidence.operationalStability.toLowerCase()}.`,
  ].filter(Boolean).join(' ');
}
