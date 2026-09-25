import type { ASTSymbol } from '@/types';
import { clamp } from '@/lib/utils';

const WEIGHTS = {
  complexity: 0.3,
  duplication: 0.25,
  blastRadius: 0.25,
  coupling: 0.2,
};

export function calculateDebtScore(params: {
  complexity: number;
  duplicationScore: number;
  blastRadius: number;
  dependencyCount: number;
}): number {
  const complexityNorm = clamp(params.complexity / 30, 0, 1) * 100;
  const duplicationNorm = clamp(params.duplicationScore, 0, 1) * 100;
  const blastNorm = clamp(params.blastRadius / 50, 0, 1) * 100;
  const couplingNorm = clamp(params.dependencyCount / 20, 0, 1) * 100;

  const raw =
    complexityNorm * WEIGHTS.complexity +
    duplicationNorm * WEIGHTS.duplication +
    blastNorm * WEIGHTS.blastRadius +
    couplingNorm * WEIGHTS.coupling;

  return Math.round(clamp(raw, 0, 100) * 10) / 10;
}

export function scoreAllSymbols(
  symbols: ASTSymbol[],
  duplicationByFile: Map<string, number>,
  blastRadiusMap: Map<string, number>
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const sym of symbols) {
    const dup = duplicationByFile.get(sym.filePath) ?? 0;
    const blast = blastRadiusMap.get(sym.id) ?? sym.calledBy.length;
    const score = calculateDebtScore({
      complexity: sym.complexity,
      duplicationScore: dup,
      blastRadius: blast,
      dependencyCount: sym.calls.length + sym.calledBy.length,
    });
    scores.set(sym.id, score);
  }

  return scores;
}

export function averageScore(scores: Map<string, number>): number {
  if (scores.size === 0) return 0;
  let sum = 0;
  for (const s of scores.values()) sum += s;
  return Math.round((sum / scores.size) * 10) / 10;
}

export function computePriority(
  debtScore: number,
  blastRadius: number
): number {
  return Math.round((debtScore * 0.6 + blastRadius * 0.4) * 10) / 10;
}
