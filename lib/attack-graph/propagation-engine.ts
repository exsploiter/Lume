import type { ASTSymbol, AttackGraphResult, AttackPath, SecurityAnalysisResult } from '@/types';
import { analyzePrivilegeEscalation } from '@/lib/attack-graph/privilege-analysis';
import { calculateDependencyRisk } from '@/lib/attack-graph/dependency-risk';
import { clampScore } from '@/lib/risk-utils';

function buildAdjacency(symbols: ASTSymbol[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const symbol of symbols) {
    adjacency.set(symbol.id, [...new Set([...symbol.calls, ...symbol.calledBy])]);
  }
  return adjacency;
}

function shortestPath(startId: string, targetId: string, adjacency: Map<string, string[]>): string[] {
  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === targetId) return current.path;
    for (const next of adjacency.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, path: [...current.path, next] });
    }
  }

  return [startId, targetId];
}

export function buildAttackPropagationGraph(params: {
  symbols: ASTSymbol[];
  securityResult: SecurityAnalysisResult | null;
  exploitabilityByNode: Record<string, {
    exploitabilityScore: number;
    publicExposure: boolean;
    attackSurfaceScore: number;
    propagationRisk: number;
    reachableSystems: string[];
    attackPaths: string[];
  }>;
  blastRadiusMap: Map<string, number>;
}): AttackGraphResult {
  const adjacency = buildAdjacency(params.symbols);
  const nodes = params.symbols.map((symbol) => symbol.id);
  const links = params.symbols.flatMap((symbol) =>
    symbol.calls.map((target) => ({ source: symbol.id, target, weight: 1 }))
  );

  const vulnerableNodes = params.symbols
    .filter((symbol) => {
      const exploitability = params.exploitabilityByNode[symbol.id]?.exploitabilityScore ?? 0;
      const security = params.securityResult?.nodeMetrics[symbol.filePath];
      return exploitability >= 45 || Boolean(security?.hasCriticalSecurity);
    })
    .slice(0, 25);

  const paths: AttackPath[] = [];
  for (const source of vulnerableNodes) {
    const sourceMetrics = params.exploitabilityByNode[source.id] ?? {
      exploitabilityScore: 0,
      publicExposure: false,
      attackSurfaceScore: 0,
      propagationRisk: 0,
      reachableSystems: [],
      attackPaths: [],
    };
    const sourcePrivilege = analyzePrivilegeEscalation(source.filePath, '');

    for (const target of vulnerableNodes) {
      if (source.id === target.id) continue;
      const path = shortestPath(source.id, target.id, adjacency);
      if (path.length < 2 || path.length > 6) continue;

      const targetMetrics = params.exploitabilityByNode[target.id] ?? sourceMetrics;
      const targetPrivilege = analyzePrivilegeEscalation(target.filePath, '');
      const targetBlastRadius = params.blastRadiusMap.get(target.id) ?? 0;
      const propagationRisk = clampScore(
        sourceMetrics.exploitabilityScore * 0.4 +
          targetMetrics.attackSurfaceScore * 0.25 +
          targetBlastRadius * 2 +
          path.length * 6,
        0,
        100
      );

      paths.push({
        sourceNode: source.id,
        targetNode: target.id,
        path,
        propagationRisk: Math.round(propagationRisk * 10) / 10,
        attackComplexity: Math.max(1, path.length - 1),
        privilegeEscalationPotential: Math.round(((sourcePrivilege.score + targetPrivilege.score) / 2) * 10) / 10,
        exposedApis: [...sourceMetrics.reachableSystems, ...targetMetrics.reachableSystems].slice(0, 6),
        exploitabilityScore: Math.round(((sourceMetrics.exploitabilityScore + targetMetrics.exploitabilityScore) / 2) * 10) / 10,
      });
    }
  }

  const criticalPaths = [...paths]
    .sort((a, b) => b.propagationRisk - a.propagationRisk || b.exploitabilityScore - a.exploitabilityScore)
    .slice(0, 15);

  const propagationRisk = paths.length
    ? Math.round(paths.reduce((total, path) => total + path.propagationRisk, 0) / paths.length)
    : 0;

  return {
    nodes,
    links,
    paths,
    criticalPaths,
    propagationRisk,
  };
}
