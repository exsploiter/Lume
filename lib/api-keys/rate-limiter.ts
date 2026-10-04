import type { RateLimitResult } from './types';

interface RequestBucket {
  timestamps: number[];
}

const buckets = new Map<string, RequestBucket>();
const WINDOW_MS = 60 * 1000; // 60 seconds

export function checkRateLimit(
  identifier: string,
  limitPerMinute: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let bucket = buckets.get(identifier);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(identifier, bucket);
  }

  // Filter timestamps within current rolling window
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  const currentCount = bucket.timestamps.length;
  const resetSeconds = Math.ceil((windowStart + WINDOW_MS) / 1000);

  if (currentCount >= limitPerMinute) {
    const oldestTimestamp = bucket.timestamps[0] || now;
    const retryAfter = Math.max(1, Math.ceil((oldestTimestamp + WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      limit: limitPerMinute,
      remaining: 0,
      reset: resetSeconds,
      retryAfter,
    };
  }

  // Record this request
  bucket.timestamps.push(now);

  return {
    allowed: true,
    limit: limitPerMinute,
    remaining: limitPerMinute - bucket.timestamps.length,
    reset: resetSeconds,
  };
}

export function clearRateLimitStore(): void {
  buckets.clear();
}
