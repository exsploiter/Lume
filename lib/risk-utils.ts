export function clampScore(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalisePath(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function containsAny(text: string, keywords: string[]): boolean {
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

export function scoreFromMatches(matches: boolean[], weights: number[]): number {
  return matches.reduce((total, matched, index) => total + (matched ? weights[index] : 0), 0);
}
