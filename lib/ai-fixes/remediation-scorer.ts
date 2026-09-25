export function scoreRemediationConfidence(params: {
  severity: 'critical' | 'high' | 'medium' | 'low';
  linesChanged: number;
  keepsPublicApi: boolean;
}): number {
  const base = { critical: 0.55, high: 0.7, medium: 0.82, low: 0.9 }[params.severity];
  const sizePenalty = Math.min(params.linesChanged * 0.02, 0.2);
  const apiPenalty = params.keepsPublicApi ? 0.08 : 0;
  return Math.max(0.1, Math.min(0.99, base - sizePenalty - apiPenalty));
}
