/**
 * lib/pipeline-runner.ts
 *
 * Thin wrapper that lets non-route code (webhooks, cron jobs, etc.) dispatch
 * a background analysis run without importing from the Next.js route module.
 *
 * It re-implements the same timeout + fire-and-forget pattern used in
 * app/api/analyze/route.ts so webhooks get identical pipeline behaviour.
 */

import { insertAnalysisRecord, updateAnalysisProgress } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/security/audit-logger';
import type { CiGateConfig } from '@/lib/github-gate';

export interface CiCdContext {
  commitSha?: string;
  prNumber?: number;
  branch?: string;
  gateConfig?: CiGateConfig;
  token?: string;
}

const MAX_RUNTIME_MS = 280_000; // 280 seconds — matches the analyze route

/**
 * Dispatches a fire-and-forget background analysis job with optional CI/CD gating.
 * Returns the analysisId immediately after enqueueing.
 */
export async function dispatchPipelineJob(params: {
  owner: string;
  repo: string;
  repoUrl: string;
  ciContext?: CiCdContext;
  progressMessage?: string;
}): Promise<string> {
  const { owner, repo, repoUrl, ciContext, progressMessage } = params;

  const analysis = await insertAnalysisRecord({
    repo_url: repoUrl,
    repo_owner: owner,
    repo_name: repo,
    status: 'pending',
    progress: 0,
    progress_message: progressMessage ?? 'Enqueued via webhook. Starting analysis...',
  });

  const analysisId = analysis.id;

  await logAuditEvent({
    eventType: 'SCAN_INITIATED',
    severity: 'info',
    status: 'in_progress',
    repo: `${owner}/${repo}`,
    details: { analysisId, repoUrl, source: 'webhook', commitSha: ciContext?.commitSha },
  });

  // Mark commit as pending early so CI shows a status immediately
  if (ciContext?.commitSha) {
    const { createCommitStatus } = await import('@/lib/github-status');
    createCommitStatus({
      owner,
      repo,
      sha: ciContext.commitSha,
      state: 'pending',
      description: 'DebtRadar: Automated scan queued via webhook...',
      context: 'debtradar/risk-gate',
      token: ciContext.token,
    }).catch((e) => console.warn('[Pipeline Runner] Failed to dispatch initial pending status:', e));
  }

  // Fire-and-forget
  runWithTimeout(analysisId, owner, repo, ciContext).catch(async (err) => {
    console.error(`[Pipeline Runner] Job ${analysisId} failed:`, err);
    try {
      await updateAnalysisProgress(analysisId, {
        status: 'failed',
        progress: 0,
        error_message: err instanceof Error ? err.message : 'Job failed',
        progress_message: 'Analysis pipeline failed',
      });
      await logAuditEvent({
        eventType: 'SCAN_FAILED',
        severity: 'error',
        status: 'failure',
        repo: `${owner}/${repo}`,
        details: { analysisId },
        error: err instanceof Error ? err.message : 'Job failed',
      });
      if (ciContext?.commitSha) {
        const { createCommitStatus } = await import('@/lib/github-status');
        createCommitStatus({
          owner,
          repo,
          sha: ciContext.commitSha,
          state: 'error',
          description: `DebtRadar analysis failed: ${err instanceof Error ? err.message.slice(0, 100) : 'Internal error'}`,
          context: 'debtradar/risk-gate',
          token: ciContext.token,
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  });

  return analysisId;
}

async function runWithTimeout(
  analysisId: string,
  owner: string,
  repo: string,
  ciContext?: CiCdContext
): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Analysis timeout: exceeded 280 seconds')), MAX_RUNTIME_MS)
  );

  const { runAnalysisPipeline } = await import('@/lib/pipeline-core');
  await Promise.race([
    runAnalysisPipeline(analysisId, owner, repo, ciContext),
    timeoutPromise,
  ]);
}
