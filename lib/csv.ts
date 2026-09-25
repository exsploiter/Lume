import Papa from 'papaparse';
import type { DebtNode, RoadmapItem } from '@/types';
import { computePriority } from '@/lib/debt-scorer';
import { computeSecurityAwarePriority } from '@/lib/security/security-scorer';
import { buildBusinessImpactFromNode } from '@/lib/business-intelligence/business-impact';
import { calculateTrustScore } from '@/lib/business-intelligence/trust-score';

export function nodesToRoadmap(nodes: DebtNode[]): RoadmapItem[] {
  return nodes
    .map((node, index) => ({
      ...(() => {
        const business = buildBusinessImpactFromNode(node);
        const trust = calculateTrustScore({
          repoSecurityScore: node.security_score,
          collapseScore: node.collapse_risk,
          exploitabilityScore: node.exploitability_score,
          propagationRisk: node.propagation_risk,
          blastRadius: node.blast_radius,
          criticalAuthIssues: node.has_critical_security ? 1 : 0,
          architectureRisk: node.collapse_risk,
        });

        return {
          businessImpact: business.businessImpact,
          deploymentUrgency: business.urgency,
          customerImpact: business.customerImpact,
          trustImpact: trust.trustScore,
          businessPriority: Math.round((trust.trustScore * 0.7) + (node.exploitability_score * 0.3) + (node.collapse_risk * 0.5)),
        };
      })(),
      rank: index + 1,
      nodeId: node.id,
      filePath: node.file_path,
      symbolName: node.symbol_name,
      debtScore: node.debt_score,
      securityScore: node.security_score,
      vulnerabilityCount: node.vulnerability_count,
      criticalSecurity: node.has_critical_security,
      owaspCategories: node.owasp_categories,
      cweCategories: node.cwe_categories,
      blastRadius: node.blast_radius,
      exploitabilityScore: node.exploitability_score,
      collapseRisk: node.collapse_risk,
      publicExposure: node.public_exposure,
      autofixAvailable: node.autofix_available,
      mergeRisk: node.merge_risk,
      securityPriority: computeSecurityAwarePriority({
        debtScore: node.debt_score,
        blastRadius: node.blast_radius,
        securityScore: node.security_score,
        exploitabilityScore: node.exploitability_score,
        collapseRisk: node.collapse_risk,
        publicExposure: node.public_exposure,
      }),
      priority: computePriority(node.debt_score, node.blast_radius),
      explanation: node.explanation,
    }))
    .sort((a, b) => b.businessPriority - a.businessPriority || b.securityPriority - a.securityPriority || b.priority - a.priority)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function exportToCSV(nodes: DebtNode[]): string {
  const roadmap = nodesToRoadmap(nodes);
  const rows = roadmap.map((item) => ({
    Rank: item.rank,
    'File Path': item.filePath,
    Symbol: item.symbolName,
    'Debt Score': item.debtScore,
    'Security Score': item.securityScore,
    'Vulnerability Count': item.vulnerabilityCount,
    'Critical Security': item.criticalSecurity,
    OWASP: item.owaspCategories.join('; '),
    'CWE Categories': item.cweCategories.join('; '),
    'Blast Radius': item.blastRadius,
    'Business Impact': item.businessImpact,
    'Deployment Urgency': item.deploymentUrgency,
    'Customer Impact': item.customerImpact,
    'Trust Impact': item.trustImpact,
    'Business Priority': item.businessPriority,
    'Exploitability Score': item.exploitabilityScore,
    'Collapse Risk': item.collapseRisk,
    'Public Exposure': item.publicExposure,
    'Autofix Available': item.autofixAvailable,
    'Merge Risk': item.mergeRisk ?? '',
    'Security Priority': item.securityPriority,
    Priority: item.priority,
    Explanation: item.explanation ?? '',
  }));
  return Papa.unparse(rows);
}
