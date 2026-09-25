import type { AttackGraphResult, ASTSymbol, SecurityAnalysisResult } from '@/types';
import { buildAttackPropagationGraph } from '@/lib/attack-graph/propagation-engine';

type ExploitabilityMap = Record<string, {
  exploitabilityScore: number;
  publicExposure: boolean;
  attackSurfaceScore: number;
  propagationRisk: number;
  reachableSystems: string[];
  attackPaths: string[];
}>;

export function buildSecurityAttackGraph(params: {
  symbols: ASTSymbol[];
  securityResult: SecurityAnalysisResult | null;
  exploitabilityByNode: ExploitabilityMap;
  blastRadiusMap: Map<string, number>;
}): AttackGraphResult {
  return buildAttackPropagationGraph({
    symbols: params.symbols,
    securityResult: params.securityResult,
    exploitabilityByNode: params.exploitabilityByNode,
    blastRadiusMap: params.blastRadiusMap,
  });
}
