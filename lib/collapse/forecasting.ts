export function buildRiskTrend(history: Array<{ label: string; value: number }>, current: number) {
  const trend = [...history.slice(-5), { label: 'now', value: current }];
  while (trend.length < 6) {
    trend.unshift({ label: 'baseline', value: current });
  }
  return trend;
}

export function estimateTimeline(score: number): string {
  if (score >= 85) return 'days';
  if (score >= 70) return 'weeks';
  if (score >= 50) return '1-2 months';
  return 'stable for now';
}
