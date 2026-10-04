import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, parseWebhookEvent } from '@/lib/github-webhook';
import { insertAnalysisRecord } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/security/audit-logger';
import { dispatchPipelineJob } from '@/lib/pipeline-runner';
import { createCommitStatus } from '@/lib/github-status';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-hub-signature-256');
  const eventType = request.headers.get('x-github-event') || 'unknown';
  const deliveryId = request.headers.get('x-github-delivery') || 'unknown';

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 1. Verify HMAC SHA-256 signature
  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.error(`[GitHub Webhook] Signature verification failed for delivery: ${deliveryId}`);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 2. Handle Ping event (GitHub App or Webhook handshake)
  if (eventType === 'ping') {
    console.log(`[GitHub Webhook] Received ping event (delivery: ${deliveryId}): "${payload.zen}"`);
    return NextResponse.json({
      message: 'pong',
      zen: payload.zen,
      hookId: payload.hook_id,
    });
  }

  // 3. Parse Push / Pull Request event
  const parsedEvent = parseWebhookEvent(eventType, payload);
  if (!parsedEvent) {
    console.log(`[GitHub Webhook] Ignored event type "${eventType}" or action "${payload.action}" (delivery: ${deliveryId})`);
    return NextResponse.json({
      message: 'Ignored webhook event',
      event: eventType,
      action: payload.action,
    });
  }

  const { owner, repo, repoUrl, commitSha, branch, prNumber, sender } = parsedEvent;
  console.log(`[GitHub Webhook] Triggering automated scan for ${owner}/${repo} on ${branch} (SHA: ${commitSha.slice(0, 7)}) triggered by @${sender}`);

  // 4. Log Audit Event
  await logAuditEvent({
    eventType: 'WEBHOOK_RECEIVED',
    severity: 'info',
    status: 'in_progress',
    actor: sender,
    repo: `${owner}/${repo}`,
    details: {
      deliveryId,
      event: eventType,
      commitSha,
      branch,
      prNumber,
      action: parsedEvent.action,
    },
  });

  // 5. Dispatch analysis with CI context — fire-and-forget via pipeline-runner
  const analysisId = await dispatchPipelineJob({
    owner,
    repo,
    repoUrl,
    ciContext: {
      commitSha,
      prNumber,
      branch,
    },
    progressMessage: `Triggered via GitHub ${eventType} (commit ${commitSha.slice(0, 7)}, branch ${branch})`,
  });

  return NextResponse.json(
    {
      message: 'Analysis initiated from GitHub webhook',
      analysisId,
      event: eventType,
      sha: commitSha,
      branch,
      prNumber,
    },
    { status: 202 }
  );
}
