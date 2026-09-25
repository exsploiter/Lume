import type { ASTSymbol, GraphLink } from '@/types';

export const MAX_GRAPH_NODES = 200;

export function computeBlastRadius(symbols: ASTSymbol[]): Map<string, number> {
  const radiusMap = new Map<string, number>();
  const adjacency = buildAdjacency(symbols);

  for (const sym of symbols) {
    const visited = new Set<string>();
    const queue = [...(adjacency.get(sym.id) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = adjacency.get(current) ?? [];
      for (const dep of deps) {
        if (!visited.has(dep)) queue.push(dep);
      }
    }
    radiusMap.set(sym.id, visited.size);
  }

  return radiusMap;
}

function buildAdjacency(symbols: ASTSymbol[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const sym of symbols) {
    const neighbors = new Set([...sym.calls, ...sym.calledBy]);
    adj.set(sym.id, [...neighbors]);
  }
  return adj;
}

export function buildGraphData(
  symbols: ASTSymbol[],
  scores: Map<string, number>,
  blastRadiusMap: Map<string, number>,
  priorityMap?: Map<string, number>
): { topSymbols: ASTSymbol[]; links: GraphLink[] } {
  const ranked = [...symbols]
    .map((s) => ({
      symbol: s,
      score: scores.get(s.id) ?? 0,
      blast: blastRadiusMap.get(s.id) ?? 0,
      priority: priorityMap?.get(s.id) ?? scores.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.priority - a.priority || b.score - a.score || b.blast - a.blast);

  const topSymbols = ranked
    .slice(0, MAX_GRAPH_NODES)
    .map((r) => r.symbol);

  const topIds = new Set(topSymbols.map((s) => s.id));
  const links: GraphLink[] = [];
  const seen = new Set<string>();

  for (const sym of topSymbols) {
    for (const depId of sym.calls) {
      if (topIds.has(depId)) {
        const key = [sym.id, depId].sort().join('->');
        if (!seen.has(key)) {
          seen.add(key);
          links.push({
            source: sym.id,
            target: depId,
            weight: priorityMap?.get(sym.id) ?? scores.get(sym.id) ?? 1,
          });
        }
      }
    }
    for (const depId of sym.calledBy) {
      if (topIds.has(depId)) {
        const key = [depId, sym.id].sort().join('->');
        if (!seen.has(key)) {
          seen.add(key);
          links.push({
            source: depId,
            target: sym.id,
            weight: priorityMap?.get(sym.id) ?? scores.get(sym.id) ?? 1,
          });
        }
      }
    }
  }

  return { topSymbols, links };
}

export function bfsFromNode(
  startId: string,
  symbols: ASTSymbol[],
  maxDepth = 3
): Set<string> {
  const symMap = new Map(symbols.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);
    const sym = symMap.get(id);
    if (!sym) continue;
    for (const neighbor of [...sym.calls, ...sym.calledBy]) {
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }
  }

  return visited;
}
