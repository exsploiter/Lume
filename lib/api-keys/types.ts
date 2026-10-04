export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  userId: string | null;
  rateLimit: number; // requests per minute
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface ApiKeyCreatedResult {
  id: string;
  name: string;
  key: string; // The unhashed raw key, returned ONLY on creation
  keyPrefix: string;
  rateLimit: number;
  createdAt: string;
}

export interface ApiKeyVerificationResult {
  valid: boolean;
  apiKey?: ApiKeyRecord;
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // seconds to wait if rate limited
}
