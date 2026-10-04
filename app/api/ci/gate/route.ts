import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAnalysis } from '@/lib/supabase/server';
import { evaluateCiGate, CiGateConfig } from '@/lib/github-gate';
import { parseGitHubUrl } from '@/lib/utils';

export const runtime = 'nodejs';

/**
 * GET /api/ci/gate
 * Query gate status by analysisId or by (repoUrl / owner+repo and commitSha)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const analysisId = searchParams.get('analysisId');
  const repoUrl = searchParams.get('repoUrl');
  const commitSha = searchParams.get('commitSha') || undefined;
  const prNumberStr = searchParams.get('prNumber');
  const prNumber = prNumberStr ? parseInt(prNumberStr, 10) : undefined;

  // Custom threshold parameters
  const minTrustScore = searchParams.get('minTrustScore') ? Number(searchParams.get('minTrustScore')) : undefined;
  const maxCriticalVulns = searchParams.get('maxCriticalVulns') ? Number(searchParams.get('maxCriticalVulns')) : undefined;
  const maxExploitability = searchParams.get('maxExploitability') ? Number(searchParams.get('maxExploitability')) : undefined;
  const failOnCollapse = searchParams.get('failOnCollapse') !== null ? searchParams.get('failOnCollapse') === 'true' : undefined;

  const customConfig: CiGateConfig = {
    minTrustScore,
    maxCriticalVulns,
    maxExploitabilityScore: maxExploitability,
    failOnCollapse,
  };

  const supabase = createServiceClient();
  let analysis = null;

  if (analysisId) {
    analysis = await getAnalysis(analysisId);
  } else if (repoUrl) {
    const { data } = await supabase
      .from('analyses')
      .select('*')
      .eq('repo_url', repoUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    analysis = data ?? null;
  }

  if (!analysis) {
    return NextResponse.json(
      { error: 'Analysis record not found. Please trigger an analysis first.' },
      { status: 404 }
    );
  }

  if (analysis.status !== 'complete' && analysis.status !== 'failed') {
    return NextResponse.json({
      status: analysis.status,
      progress: analysis.progress,
      message: analysis.progress_message || 'Analysis in progress',
      passed: false,
      gateEvaluated: false,
    });
  }

  if (analysis.status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      passed: false,
      gateEvaluated: true,
      error: analysis.error_message || 'Analysis pipeline failed',
    });
  }

  const gateResult = evaluateCiGate(analysis, customConfig, {
    owner: analysis.repo_owner,
    repo: analysis.repo_name,
    commitSha,
    prNumber,
  });

  return NextResponse.json({
    analysisId: analysis.id,
    repo: `${analysis.repo_owner}/${analysis.repo_name}`,
    status: 'complete',
    gateEvaluated: true,
    ...gateResult,
  });
}

/**
 * POST /api/ci/gate
 * Manually evaluate gate for a completed analysis or trigger scan with gating
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisId, repoUrl, commitSha, prNumber, gateConfig } = body;

    let targetAnalysisId = analysisId;

    if (!targetAnalysisId && repoUrl) {
      const parsed = parseGitHubUrl(repoUrl);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid repoUrl' }, { status: 400 });
      }

      const supabase = createServiceClient();
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('repo_url', repoUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        targetAnalysisId = data.id;
      }
    }

    if (!targetAnalysisId) {
      return NextResponse.json({ error: 'analysisId or valid repoUrl is required' }, { status: 400 });
    }

    const analysis = await getAnalysis(targetAnalysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const gateResult = evaluateCiGate(analysis, gateConfig, {
      owner: analysis.repo_owner,
      repo: analysis.repo_name,
      commitSha,
      prNumber,
    });

    return NextResponse.json({
      analysisId: analysis.id,
      repo: `${analysis.repo_owner}/${analysis.repo_name}`,
      status: analysis.status,
      gateResult,
    });
  } catch (error) {
    console.error('[CI Gate API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate CI gate' },
      { status: 500 }
    );
  }
}
