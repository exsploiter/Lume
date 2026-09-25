import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import type { GraphLink } from '@/types';
import { buildBusinessImpactFromNode } from '@/lib/business-intelligence/business-impact';
import { predictConsequences } from '@/lib/business-intelligence/consequence-engine';
import { calculateTrustScore } from '@/lib/business-intelligence/trust-score';
import { calculateDeploymentConfidence } from '@/lib/business-intelligence/deployment-confidence';
import { buildExecutiveSummary } from '@/lib/business-intelligence/executive-summary';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysis = await getAnalysis(params.id);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const nodes = await getDebtNodes(params.id);

    const symbolToNodeId = new Map<string, string>();
    for (const node of nodes) {
      symbolToNodeId.set(`${node.file_path}::${node.symbol_name}`, node.id);
    }

    const links: GraphLink[] = [];
    const seen = new Set<string>();

    for (const node of nodes) {
      const deps = (node.dependencies as string[]) ?? [];
      for (const depKey of deps) {
        const targetId = symbolToNodeId.get(depKey) ?? depKey;
        const targetNode = nodes.find((n) => n.id === targetId);
        if (!targetNode) continue;
        const key = [node.id, targetNode.id].sort().join('->');
        if (!seen.has(key)) {
          seen.add(key);
          links.push({
            source: node.id,
            target: targetNode.id,
            weight: node.debt_score,
          });
        }
      }
    }

    const businessTranslations = nodes.slice(0, 8).map((node) => buildBusinessImpactFromNode(node));
    const customerImpact = [...new Set(businessTranslations.map((item) => item.customerImpact))].slice(0, 5);
    const operationalRisks = [...new Set(businessTranslations.map((item) => item.operationalRisk))].slice(0, 5);
    const businessRisks = [...new Set(businessTranslations.flatMap((item) => item.impactTypes))].slice(0, 6);

    const criticalAuthIssues = nodes.filter((node) => {
      const text = `${node.symbol_name} ${node.file_path} ${(node.security_findings ?? []).map((finding) => finding.title).join(' ')}`;
      return /auth|jwt|session|login|authorization/i.test(text) && (node.security_risk_level === 'critical' || node.has_critical_security);
    }).length;

    const repoSecurityScore = analysis.repo_security_score ?? 0;
    const collapseScore = analysis.collapse_score ?? 0;
    const repoExploitabilityScore = analysis.repo_exploitability_score ?? 0;

    const trustScore = calculateTrustScore({
      repoSecurityScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      blastRadius: nodes.length > 0 ? Math.round(nodes.reduce((total, node) => total + node.blast_radius, 0) / nodes.length) : 0,
      criticalAuthIssues,
      architectureRisk: collapseScore,
    });

    const deploymentConfidence = calculateDeploymentConfidence({
      repoSecurityScore,
      trustScore: trustScore.trustScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      criticalAuthIssues,
    });

    const consequenceForecasts = nodes.slice(0, 5).map((node) => predictConsequences({
      vulnerabilityType: node.security_findings?.[0]?.title ?? node.symbol_name,
      exploitabilityScore: node.exploitability_score ?? node.security_score ?? 0,
      blastRadius: node.blast_radius ?? 0,
      systemCriticality: node.security_weighted_score ?? 0,
      architectureRisk: node.collapse_risk ?? 0,
    }));

    const ignoreConsequences = consequenceForecasts.map((forecast) => forecast.shortTermImpact);

    const executiveSummary = buildExecutiveSummary({
      repoName: `${analysis.repo_owner}/${analysis.repo_name}`,
      trustScore,
      deploymentConfidence,
      translations: businessTranslations,
      consequences: consequenceForecasts,
    });

    const enrichedAnalysis = {
      ...analysis,
      executiveSummary,
      deploymentConfidence: deploymentConfidence.deploymentConfidence,
      trustScore: trustScore.trustScore,
      deploymentRecommendation: deploymentConfidence.deploymentRecommendation,
      businessRisks,
      operationalRisks,
      customerImpact,
      ignoreConsequences,
      consequenceForecast: consequenceForecasts[0] ?? null,
    };

    return NextResponse.json({
      analysis: enrichedAnalysis,
      nodes,
      links,
      executiveSummary,
      deploymentConfidence,
      trustScore,
      businessRisks,
      operationalRisks,
      customerImpact,
      ignoreConsequences,
      consequenceForecast: consequenceForecasts[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
