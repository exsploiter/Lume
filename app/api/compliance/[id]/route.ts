import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { evaluateComprehensiveCompliance } from '@/lib/business-intelligence/compliance-matrix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const analysis = await getAnalysis(analysisId);

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const nodes = await getDebtNodes(analysisId);
    const audit = evaluateComprehensiveCompliance({ analysis, nodes });

    return NextResponse.json(audit);
  } catch (err) {
    console.error('[API /api/compliance/[id]] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to evaluate compliance' },
      { status: 500 }
    );
  }
}
