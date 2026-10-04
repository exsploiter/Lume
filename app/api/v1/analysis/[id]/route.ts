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

    const trustScoreResult = calculateTrustScore({
      repoSecurityScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      blastRadius: nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.blast_radius, 0) / nodes.length) : 0,
      criticalAuthIssues: criticalVulnerabilities,
      architectureRisk: collapseScore,
    });

    const deploymentConfidence = calculateDeploymentConfidence({
      repoSecurityScore,
      trustScore: trustScoreResult.trustScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      criticalAuthIssues: criticalVulnerabilities,
    });

    const responsePayload = {
      id: analysis.id,
      status: analysis.status,
      progress: analysis.progress,
      progressMessage: analysis.progress_message,
      errorMessage: analysis.error_message,
      repository: {
        url: analysis.repo_url,
        owner: analysis.repo_owner,
        name: analysis.repo_name,
      },
      metrics: {
        totalFiles: analysis.total_files,
        totalNodes: analysis.total_nodes,
        avgDebtScore: analysis.avg_debt_score,
        repoSecurityScore: analysis.repo_security_score,
        collapseScore: analysis.collapse_score,
        repoExploitabilityScore: analysis.repo_exploitability_score,
        criticalVulnerabilities: analysis.critical_vulnerabilities,
      },
      trustScore: {
        score: trustScoreResult.trustScore,
        recommendation: trustScoreResult.recommendation,
        deploymentConfidence: deploymentConfidence.deploymentConfidence,
        operationalStability: trustScoreResult.operationalStability,
        securityExposure: trustScoreResult.securityExposure,
        architectureHealth: trustScoreResult.architectureHealth,
      },
      securitySummary: analysis.security_summary,
      collapsePrediction: analysis.collapse_prediction,
      highRiskAttackPaths: analysis.high_risk_attack_paths,
      createdAt: analysis.created_at,
      updatedAt: analysis.updated_at,
    };

    const res = NextResponse.json(responsePayload);
    return attachRateLimitHeaders(res, auth.rateLimit);
  } catch (err) {
    console.error(`[API v1 /api/v1/analysis/${params.id}] Error:`, err);
    const errRes = NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
    return attachRateLimitHeaders(errRes, auth.rateLimit);
  }
}
