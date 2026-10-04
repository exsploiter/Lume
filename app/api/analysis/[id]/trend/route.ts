import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getHistoricalAnalysesForRepo } from '@/lib/supabase/server';
import { analyzeHistoricalTrend } from '@/lib/business-intelligence/trend-analyzer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const currentAnalysis = await getAnalysis(analysisId);

    if (!currentAnalysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const repoUrl = currentAnalysis.repo_url;
    const historicalAnalyses = await getHistoricalAnalysesForRepo(repoUrl, 25);

    // Make sure current analysis is in the list if not already returned
    const exists = historicalAnalyses.some((a) => a.id === currentAnalysis.id);
    const combined = exists ? historicalAnalyses : [...historicalAnalyses, currentAnalysis];

    const trend = analyzeHistoricalTrend(combined, repoUrl);

    return NextResponse.json(trend);
  } catch (err) {
    console.error('[API /api/analysis/[id]/trend] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze trend' },
      { status: 500 }
    );
  }
}
