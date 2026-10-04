import { EventEmitter } from 'events';

export interface ProgressEventPayload {
  analysisId: string;
  status: string;
  progress: number;
  message?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

class AnalysisProgressEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow many concurrent SSE client connections
    this.setMaxListeners(200);
  }

  public emitProgress(payload: ProgressEventPayload): void {
    this.emit(`progress:${payload.analysisId}`, payload);
  }

  public subscribe(
    analysisId: string,
    listener: (payload: ProgressEventPayload) => void
  ): () => void {
    const eventName = `progress:${analysisId}`;
    this.on(eventName, listener);
    return () => {
      this.off(eventName, listener);
    };
  }
}

// Global singleton instance so it persists across API requests in Node runtime
const globalProgressEmitter = (globalThis as unknown as { __progressEmitter?: AnalysisProgressEmitter }).__progressEmitter ??
  new AnalysisProgressEmitter();

if (process.env.NODE_ENV !== 'production') {
  (globalThis as unknown as { __progressEmitter?: AnalysisProgressEmitter }).__progressEmitter = globalProgressEmitter;
}

export const progressEmitter = globalProgressEmitter;
