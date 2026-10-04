import { NextResponse } from 'next/server';
import { runAIEvaluationHarness } from '@/lib/ai/eval-harness';
import { getExplanationCacheStats } from '@/lib/ai/explanation-cache';
import { PROMPT_REGISTRY, ACTIVE_PROMPT_VERSION } from '@/lib/ai/prompt-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cacheStats = getExplanationCacheStats();
  return NextResponse.json({
    activePromptVersion: ACTIVE_PROMPT_VERSION,
    availableVersions: Object.keys(PROMPT_REGISTRY),
    cacheStats,
    message: 'Send POST to this endpoint to run the full AI evaluation benchmark harness.',
  });
}

export async function POST() {
  try {
    console.log('[AI Eval] Starting evaluation harness run...');
    const report = await runAIEvaluationHarness();
    console.log(`[AI Eval] Harness finished: ${report.passedTests}/${report.totalTests} passed. Avg latency: ${report.averageLatencyMs}ms`);
    return NextResponse.json(report);
  } catch (err) {
    console.error('[AI Eval Error] Failed during evaluation run:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation harness failed' },
      { status: 500 }
    );
  }
}
