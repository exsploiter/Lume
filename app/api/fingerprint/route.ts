import { NextRequest, NextResponse } from 'next/server';
import { classifyAgentCode } from '@/lib/huggingface';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { codeSnippet, nodeId, analysisId } = await request.json();
    if (!codeSnippet) {
      return NextResponse.json({ error: 'codeSnippet is required' }, { status: 400 });
    }

    const result = await classifyAgentCode(codeSnippet);

    if (nodeId) {
      const supabase = createServiceClient();
      await supabase
        .from('debt_nodes')
        .update({ fingerprint_tag: result.label })
        .eq('id', nodeId);
    }

    if (analysisId && !nodeId) {
      const supabase = createServiceClient();
      await supabase
        .from('analyses')
        .update({
          fingerprint_label: result.label,
          fingerprint_confidence: result.confidence,
        })
        .eq('id', analysisId);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fingerprint failed' },
      { status: 500 }
    );
  }
}
