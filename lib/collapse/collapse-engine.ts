import type { ASTSymbol, CollapsePredictionResult, ExploitabilityResult, SecurityAnalysisResult } from '@/types';
import { calculateCollapseScore } from '@/lib/collapse/collapse-score';
import { buildRiskTrend, estimateTimeline } from '@/lib/collapse/forecasting';

export function buildCollapsePrediction(params: {
  repoSecurityScore: number;
  criticalVulnerabilities: number;
  securityResult: SecurityAnalysisResult | null;
  exploitabilityResult: ExploitabilityResult;
  symbols: ASTSymbol[];
  blastRadiusMap: Map<string, number>;
  history?: Array<{ label: string; value: number }>;
}): CollapsePredictionResult {
  const averageBlastRadius = params.symbols.length
    ? params.symbols.reduce((total, symbol) => total + (params.blastRadiusMap.get(symbol.id) ?? 0), 0) / params.symbols.length
    : 0;

  const instabilityDrivers = [
    ...(params.securityResult?.collapse.reasons ?? []),
    ...(params.exploitabilityResult.publicExposureFiles.length ? ['public attack surface'] : []),
    ...(params.exploitabilityResult.reachableAttackChains > 0 ? ['multi-step attack chains'] : []),
  ];

  const collapseScore = calculateCollapseScore({
    repoSecurityScore: params.repoSecurityScore,
    repoExploitabilityScore: params.exploitabilityResult.repoExploitabilityScore,
    criticalVulnerabilities: params.criticalVulnerabilities,
    propagationRisk: params.securityResult?.collapse.propagationRisk ?? 0,
    averageBlastRadius,
    instabilityDrivers: instabilityDrivers.length,
  });

  const criticalModules = [...new Set(params.exploitabilityResult.publicExposureFiles)].slice(0, 6);
  const currentTrend = buildRiskTrend(params.history ?? [], collapseScore);

  return {
    collapseProbability: Math.round(Math.min(100, collapseScore + (params.securityResult?.collapse.isCollapsed ? 8 : 0))),
    collapseScore,
    predictedTimeline: estimateTimeline(collapseScore),
    criticalModules,
    instabilityDrivers,
    recommendedInterventions: [
      'reduce attack surface in public routes',
      'extract high blast-radius helpers',
      'add auth checks before sensitive writes',
    ],
    riskTrend: currentTrend,
  };
}
