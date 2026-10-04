import { randomBytes, createHash, randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createServiceClient } from '@/lib/supabase/server';
import type { ApiKeyRecord, ApiKeyCreatedResult, ApiKeyVerificationResult } from './types';

const LOCAL_DATA_DIR = path.join(process.cwd(), '.lume-data');
const API_KEYS_FILE = path.join(LOCAL_DATA_DIR, 'api-keys.json');

async function ensureLocalStore() {
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
}

async function loadLocalKeys(): Promise<ApiKeyRecord[]> {
  try {
    await ensureLocalStore();
    const raw = await readFile(API_KEYS_FILE, 'utf8');
    return JSON.parse(raw) as ApiKeyRecord[];
  } catch {
    return [];
  }
}

async function saveLocalKeys(keys: ApiKeyRecord[]): Promise<void> {
  await ensureLocalStore();
  await writeFile(API_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex');
}

export function generateRawApiKey(): { rawKey: string; prefix: string } {
  const hex = randomBytes(24).toString('hex');
  const rawKey = `dr_live_${hex}`;
  const prefix = `dr_live_${hex.slice(0, 6)}...`;
  return { rawKey, prefix };
}

export async function createApiKey(params: {
  name: string;
  userId?: string | null;
  rateLimit?: number;
}): Promise<ApiKeyCreatedResult> {
  const { rawKey, prefix } = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const id = randomUUID();
  const now = new Date().toISOString();
  const rateLimit = params.rateLimit ?? 60;

  const record: ApiKeyRecord = {
    id,
    name: params.name || 'Default API Key',
    keyPrefix: prefix,
    keyHash,
    userId: params.userId ?? null,
    rateLimit,
    createdAt: now,
    lastUsedAt: null,
    isActive: true,
  };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('api_keys').insert({
      id: record.id,
      name: record.name,
      key_prefix: record.keyPrefix,
      key_hash: record.keyHash,
      user_id: record.userId,
      rate_limit: record.rateLimit,
      is_active: record.isActive,
      created_at: record.createdAt,
    });

    if (!error) {
      return {
        id,
        name: record.name,
        key: rawKey,
        keyPrefix: prefix,
        rateLimit,
        createdAt: now,
      };
    }
  } catch {
    // Fall back to local storage
  }

  const localKeys = await loadLocalKeys();
  localKeys.push(record);
  await saveLocalKeys(localKeys);

  return {
    id,
    name: record.name,
    key: rawKey,
    keyPrefix: prefix,
    rateLimit,
    createdAt: now,
  };
}

export async function listApiKeys(userId?: string | null): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase.from('api_keys').select('id, name, key_prefix, user_id, rate_limit, created_at, last_used_at, is_active').order('created_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data.map((item) => ({
        id: item.id,
        name: item.name,
        keyPrefix: item.key_prefix,
        userId: item.user_id,
        rateLimit: item.rate_limit,
        createdAt: item.created_at,
        lastUsedAt: item.last_used_at,
        isActive: item.is_active,
      }));
    }
  } catch {
    // Fall back to local
  }

  const localKeys = await loadLocalKeys();
  const filtered = userId ? localKeys.filter((k) => k.userId === userId) : localKeys;
  return filtered.map(({ keyHash, ...rest }) => rest);
}

export async function verifyAndGetApiKey(rawKey: string): Promise<ApiKeyVerificationResult> {
  if (!rawKey || !rawKey.startsWith('dr_live_')) {
    return { valid: false, error: 'Invalid API key format. Expected dr_live_...' };
  }

  const hash = hashApiKey(rawKey);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', hash)
      .single();

    if (!error && data) {
      if (!data.is_active) {
        return { valid: false, error: 'API key has been revoked or deactivated.' };
      }
      return {
        valid: true,
        apiKey: {
          id: data.id,
          name: data.name,
          keyPrefix: data.key_prefix,
          keyHash: data.key_hash,
          userId: data.user_id,
          rateLimit: data.rate_limit ?? 60,
          createdAt: data.created_at,
          lastUsedAt: data.last_used_at,
          isActive: data.is_active,
        },
      };
    }
  } catch {
    // Fall back to local
  }

  const localKeys = await loadLocalKeys();
  const matched = localKeys.find((k) => k.keyHash === hash);
  if (!matched) {
    return { valid: false, error: 'API key not recognized.' };
  }

  if (!matched.isActive) {
    return { valid: false, error: 'API key has been revoked.' };
  }

  return { valid: true, apiKey: matched };
}

export async function touchApiKeyUsage(id: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const supabase = createServiceClient();
    await supabase.from('api_keys').update({ last_used_at: now }).eq('id', id);
  } catch {
    // Ignore
  }

  try {
    const localKeys = await loadLocalKeys();
    const index = localKeys.findIndex((k) => k.id === id);
    if (index !== -1) {
      localKeys[index].lastUsedAt = now;
      await saveLocalKeys(localKeys);
    }
  } catch {
    // Ignore
  }
}

export async function revokeApiKey(id: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('id', id);
    if (!error) return true;
  } catch {
    // Ignore
  }

  const localKeys = await loadLocalKeys();
  const index = localKeys.findIndex((k) => k.id === id);
  if (index !== -1) {
    localKeys[index].isActive = false;
    await saveLocalKeys(localKeys);
    return true;
  }
  return false;
}
