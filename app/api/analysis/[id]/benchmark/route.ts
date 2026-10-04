import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getAllCompletedAnalyses } from '@/lib/supabase/server';
import { calculatePeerBenchmark } from '@/lib/business-intelligence/peer-benchmarking';

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

    const cohortAnalyses = await getAllCompletedAnalyses(100);
    const benchmark = calculatePeerBenchmark(currentAnalysis, cohortAnalyses);

    return NextResponse.json(benchmark);
  } catch (err) {
    console.error('[API /api/analysis/[id]/benchmark] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to calculate peer benchmark' },
      { status: 500 }
    );
  }
}
