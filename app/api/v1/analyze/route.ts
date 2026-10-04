import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, attachRateLimitHeaders } from '@/lib/api-keys/middleware';
import { dispatchPipelineJob } from '@/lib/pipeline-runner';
import { parseGitHubUrl } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Authenticate & Rate-limit
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { repoUrl, branch, ciContext } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      const errRes = NextResponse.json(
        { error: 'Bad Request', message: 'Missing required string field: repoUrl' },
        { status: 400 }
      );
      return attachRateLimitHeaders(errRes, auth.rateLimit);
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      const errRes = NextResponse.json(
        { error: 'Invalid URL', message: `Invalid GitHub repository URL: ${repoUrl}` },
        { status: 400 }
      );
      return attachRateLimitHeaders(errRes, auth.rateLimit);
    }

    const { owner, repo } = parsed;

    // 2. Dispatch background analysis job
    const analysisId = await dispatchPipelineJob({
      owner,
      repo,
      repoUrl,
      ciContext: {
        branch: branch || ciContext?.branch,
        commitSha: ciContext?.commitSha,
        prNumber: ciContext?.prNumber,
        gateConfig: ciContext?.gateConfig,
        token: ciContext?.token,
      },
      progressMessage: `API v1 trigger by key ${auth.apiKey.keyPrefix}. Starting analysis...`,
    });

    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${proto}://${host}`;

    const res = NextResponse.json(
      {
        status: 'queued',
        analysisId,
        repo: `${owner}/${repo}`,
        statusUrl: `${baseUrl}/api/v1/analysis/${analysisId}`,
        trustScoreUrl: `${baseUrl}/api/v1/trust-score/${analysisId}`,
        complianceUrl: `${baseUrl}/api/v1/compliance/${analysisId}`,
        dashboardUrl: `${baseUrl}/analyze/${analysisId}`,
        message: 'Analysis job accepted and queued for processing.',
      },
      { status: 202 }
    );

    return attachRateLimitHeaders(res, auth.rateLimit);
  } catch (err) {
    console.error('[API v1 /api/v1/analyze] Error:', err);
    const errRes = NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
    return attachRateLimitHeaders(errRes, auth.rateLimit);
  }
}
