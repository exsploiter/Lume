import type { BusinessTranslationResult, DebtNode } from '@/types';
import { translateTechnicalRisk } from '@/lib/business-intelligence/risk-translator';

export function buildBusinessImpactFromNode(node: DebtNode): BusinessTranslationResult {
  const finding = node.security_findings?.[0];
  const technicalFinding = finding?.title ?? `${node.symbol_name} in ${node.file_path}`;

  return translateTechnicalRisk({
    technicalFinding,
    severity: finding?.severity ?? (node.security_risk_level === 'critical' ? 'critical' : node.security_risk_level === 'high' ? 'high' : 'medium'),
    exploitability: node.exploitability_score ?? node.security_score ?? 0,
    blastRadius: node.blast_radius ?? 0,
    affectedSystems: [node.file_path, ...(node.dependencies ?? []).slice(0, 2)],
  });
}
