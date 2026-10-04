import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { PromptContext } from './prompt-registry';

interface CacheEntry {
  key: string;
  explanation: string;
  version: string;
  cachedAt: number;
  hitCount: number;
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'explanation_cache.json');
const memoryCache = new Map<string, CacheEntry>();
let cacheLoaded = false;
let stats = {
  hits: 0,
  misses: 0,
};

function ensureDirExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch {
    // ignore
  }
}

function loadDiskCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw) as Record<string, CacheEntry>;
      for (const [k, v] of Object.entries(data)) {
        memoryCache.set(k, v);
      }
    }
  } catch (err) {
    console.warn('[Explanation Cache] Could not load disk cache:', err);
  }
}

function persistDiskCache() {
  try {
    ensureDirExists(path.dirname(CACHE_FILE));
    const obj: Record<string, CacheEntry> = {};
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Explanation Cache] Could not persist to disk:', err);
  }
}

export function computeExplanationCacheKey(ctx: PromptContext, promptVersion: string): string {
  const content = JSON.stringify({
    path: ctx.filePath,
    sym: ctx.symbolName,
    code: ctx.codeSnippet,
    v: promptVersion,
    sec: ctx.securityScore ?? 0,
    vuln: ctx.vulnerabilityCount ?? 0,
    findings: (ctx.securityFindings || []).map(f => `${f.title}:${f.severity}`),
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function getCachedExplanation(ctx: PromptContext, promptVersion: string): string | null {
  loadDiskCache();
  const key = computeExplanationCacheKey(ctx, promptVersion);
  const entry = memoryCache.get(key);

  if (entry) {
    stats.hits++;
    entry.hitCount++;
    return entry.explanation;
  }

  stats.misses++;
  return null;
}

export function setCachedExplanation(
  ctx: PromptContext,
  promptVersion: string,
  explanation: string
): void {
  loadDiskCache();
  const key = computeExplanationCacheKey(ctx, promptVersion);
  const entry: CacheEntry = {
    key,
    explanation,
    version: promptVersion,
    cachedAt: Date.now(),
    hitCount: 1,
  };
  memoryCache.set(key, entry);

  // Debounced/async persist to disk
  setTimeout(() => persistDiskCache(), 100);
}

export function getExplanationCacheStats() {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    totalQueries: total,
    hitRate: total > 0 ? Number((stats.hits / total).toFixed(3)) : 0,
    cacheSize: memoryCache.size,
  };
}
