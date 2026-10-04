import { NextRequest, NextResponse } from 'next/server';
import { verifyAndGetApiKey, touchApiKeyUsage } from './key-store';
import { checkRateLimit } from './rate-limiter';
import type { ApiKeyRecord, RateLimitResult } from './types';

export interface AuthContextSuccess {
  success: true;
  apiKey: ApiKeyRecord;
  rateLimit: RateLimitResult;
}

export interface AuthContextFailure {
  success: false;
  response: NextResponse;
}

export type AuthContextResult = AuthContextSuccess | AuthContextFailure;

export async function authenticateApiRequest(
  request: NextRequest,
  customLimit?: number
): Promise<AuthContextResult> {
  // 1. Extract API key from Authorization header or X-API-Key
  const authHeader = request.headers.get('authorization') || '';
  const xApiKey = request.headers.get('x-api-key') || '';

  let rawKey = '';
  if (authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  } else if (authHeader.startsWith('dr_live_')) {
    rawKey = authHeader.trim();
  } else if (xApiKey.trim()) {
    rawKey = xApiKey.trim();
  }

  if (!rawKey) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized: Missing API key.',
          message: 'Provide your API key in the Authorization header (`Bearer dr_live_...`) or `X-API-Key` header.',
          documentation: 'https://debtradar.io/docs/api',
        },
        { status: 401 }
      ),
    };
  }

  // 2. Verify API Key
  const verification = await verifyAndGetApiKey(rawKey);
  if (!verification.valid || !verification.apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized: Invalid API key.',
          message: verification.error || 'The provided API key is invalid or revoked.',
        },
        { status: 401 }
      ),
    };
  }

  const apiKey = verification.apiKey;
  const limit = customLimit ?? apiKey.rateLimit ?? 60;

  // 3. Evaluate Rate Limit
  const rateLimit = checkRateLimit(apiKey.id, limit);
  if (!rateLimit.allowed) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `API rate limit exceeded (${rateLimit.limit} req/min). Please retry in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.reset),
            'Retry-After': String(rateLimit.retryAfter ?? 60),
          },
        }
      ),
    };
  }

  // 4. Update usage in background
  touchApiKeyUsage(apiKey.id).catch(() => {});

  return {
    success: true,
    apiKey,
    rateLimit,
  };
}

export function attachRateLimitHeaders(
  response: NextResponse,
  rateLimit: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(rateLimit.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimit.reset));
  return response;
}
