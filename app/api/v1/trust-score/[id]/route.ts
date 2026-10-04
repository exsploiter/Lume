import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, attachRateLimitHeaders } from '@/lib/api-keys/middleware';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { calculateTrustScore } from '@/lib/business-intelligence/trust-score';
import { calculateDeploymentConfidence } from '@/lib/business-intelligence/deployment-confidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const analysisId = params.id;
    const analysis = await getAnalysis(analysisId);

    if (!analysis) {
      const notFoundRes = NextResponse.json(
        { error: 'Not Found', message: `Analysis ${analysisId} not found.` },
        { status: 404 }
      );
      return attachRateLimitHeaders(notFoundRes, auth.rateLimit);
    }

    const nodes = await getDebtNodes(analysisId);
    const repoSecurityScore = analysis.repo_security_score ?? 0;
    const collapseScore = analysis.collapse_score ?? 0;
    const repoExploitabilityScore = analysis.repo_exploitability_score ?? 0;
    const criticalVulnerabilities = analysis.critical_vulnerabilities ?? 0;

    const trustResult = calculateTrustScore({
      repoSecurityScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      blastRadius: nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.blast_radius, 0) / nodes.length) : 0,
      criticalAuthIssues: criticalVulnerabilities,
      architectureRisk: collapseScore,
    });

    const confidenceResult = calculateDeploymentConfidence({
      repoSecurityScore,
      trustScore: trustResult.trustScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      criticalAuthIssues: criticalVulnerabilities,
    });

    const isGatePassed = trustResult.trustScore >= 60 && criticalVulnerabilities === 0;

    const res = NextResponse.json({
      analysisId: analysis.id,
      repo: `${analysis.repo_owner}/${analysis.repo_name}`,
      trustScore: trustResult.trustScore,
      recommendation: trustResult.recommendation,
      deploymentConfidence: confidenceResult.deploymentConfidence,
      gatePassed: isGatePassed,
      breakdown: {
        securityScore: repoSecurityScore,
        exploitabilityScore: repoExploitabilityScore,
        collapseScore,
        criticalVulnerabilities,
        operationalStability: trustResult.operationalStability,
        securityExposure: trustResult.securityExposure,
        architectureHealth: trustResult.architectureHealth,
      },
      reasons: trustResult.reasons,
    });

    return attachRateLimitHeaders(res, auth.rateLimit);
  } catch (err) {
    console.error(`[API v1 /api/v1/trust-score/${params.id}] Error:`, err);
    const errRes = NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
    return attachRateLimitHeaders(errRes, auth.rateLimit);
  }
}
