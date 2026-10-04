import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, attachRateLimitHeaders } from '@/lib/api-keys/middleware';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { evaluateComprehensiveCompliance } from '@/lib/business-intelligence/compliance-matrix';

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
    const audit = evaluateComprehensiveCompliance({ analysis, nodes });

    const frameworksSummary: Record<string, unknown> = {};
    for (const [fwKey, fw] of Object.entries(audit.frameworks)) {
      frameworksSummary[fwKey] = {
        name: fw.displayName,
        version: fw.version,
        readinessScore: fw.readinessScore,
        status: fw.status,
        passingControls: fw.passingControls,
        warningControls: fw.warningControls,
        failingControls: fw.failingControls,
        summary: fw.summary,
      };
    }

    const res = NextResponse.json({
      analysisId: audit.analysisId,
      repository: `${audit.repoOwner}/${audit.repoName}`,
      overallReadinessScore: audit.overallReadinessScore,
      overallGrade: audit.overallGrade,
      frameworks: frameworksSummary,
      criticalGaps: audit.criticalGaps,
      remediationRoadmap: audit.remediationRoadmap,
    });

    return attachRateLimitHeaders(res, auth.rateLimit);
  } catch (err) {
    console.error(`[API v1 /api/v1/compliance/${params.id}] Error:`, err);
    const errRes = NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
    return attachRateLimitHeaders(errRes, auth.rateLimit);
  }
}
