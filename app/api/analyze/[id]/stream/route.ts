import { NextRequest } from 'next/server';
import { progressEmitter, ProgressEventPayload } from '@/lib/job-queue/progress-emitter';
import { getAnalysis } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: analysisId } = await params;

  if (!analysisId) {
    return new Response(JSON.stringify({ error: 'Missing analysis ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const initialRecord = await getAnalysis(analysisId);

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          isClosed = true;
        }
      };

      // 1. Send initial state immediately
      if (initialRecord) {
        sendEvent('progress', {
          analysisId,
          status: initialRecord.status,
          progress: initialRecord.progress,
          message: initialRecord.progress_message ?? '',
          timestamp: Date.now(),
          data: {
            total_files: initialRecord.total_files,
            total_nodes: initialRecord.total_nodes,
            avg_debt_score: initialRecord.avg_debt_score,
            repo_security_score: initialRecord.repo_security_score,
            collapse_score: initialRecord.collapse_score,
            security_collapse: initialRecord.security_collapse,
          },
        });

        if (initialRecord.status === 'complete' || initialRecord.status === 'failed') {
          sendEvent('done', { status: initialRecord.status });
          controller.close();
          isClosed = true;
          return;
        }
      }

      // 2. Subscribe to progress events emitted during analysis
      const unsubscribe = progressEmitter.subscribe(
        analysisId,
        (eventPayload: ProgressEventPayload) => {
          if (isClosed) return;
          sendEvent('progress', eventPayload);

          if (eventPayload.status === 'complete' || eventPayload.status === 'failed') {
            sendEvent('done', { status: eventPayload.status });
            unsubscribe();
            try {
              controller.close();
            } catch {
              // ignore
            }
            isClosed = true;
          }
        }
      );

      // Keepalive heartbeat every 15s to prevent intermediary proxies/browsers from terminating connection
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          isClosed = true;
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 15000);

      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
