import type { ParsedFile } from '@/types';

const JS_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rs'
]);

const MAX_FILES = 250;
const MAX_FILE_SIZE = 100_000; // 100KB per file

const PROBLEMATIC_PATHS = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  '.nuxt/',
  '.cache/',
  'out/',
  'public/',
  'static/',
  'vendor/',
  'bower_components/',
  'tmp/',
  'temp/',
  '.serverless/',
  'coverage/',
  '.git/',
];

const PROBLEMATIC_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'postcss.config.js',
  'tailwind.config.js',
  'webpack.config.js',
  'babel.config.js',
  '.eslintrc.json',
  'package.json',
  'vite.config.ts',
  'vite.config.js',
  'gatsby-config.js',
  'angular.json',
  'svelte.config.js',
];

const PROBLEMATIC_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3',
  '.woff', '.woff2', '.ttf', '.eot', '.map',
  '.css', '.scss', '.sass', '.less', '.html', '.json', '.md',
  '.yml', '.yaml', '.ini', '.conf', '.xml', '.txt'
]);

interface CacheEntry {
  data: any;
  expiry: number;
}

class GitHubClient {
  private cache = new Map<string, CacheEntry>();
  private pendingPromises = new Map<string, Promise<any>>();
  private rateLimitRemaining = 5000;
  private rateLimitReset = 0;

  constructor() {
    // Startup Validation (Requirement 2)
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn("[GitHubClient Startup Warning] GITHUB_TOKEN environment variable is missing or undefined.");
    }
  }

  public getRateLimits() {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset
    };
  }

  /**
   * Centralized HTTP requester with logging, deduplication, caching, and rate-limiting throttling (Requirement 3)
   */
  public async fetchJson<T>(url: string, options: RequestInit = {}, ttlSeconds = 600): Promise<T> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Startup validation failed: GITHUB_TOKEN environment variable is missing or undefined.");
    }

    const cacheKey = `${url}:${options.method || 'GET'}:${JSON.stringify(options.body || '')}`;

    // 1. In-memory Aggressive caching check (Requirement 4)
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[GitHub Cache] Hit: ${url}`);
      return cached.data as T;
    }

    // 2. Active promise request deduplication (Requirement 20)
    const pending = this.pendingPromises.get(cacheKey);
    if (pending) {
      console.log(`[GitHub Dedupe] Subscribing to existing in-flight: ${url}`);
      return pending as Promise<T>;
    }

    // 3. Centralized Rate Limit Awareness and Auto-Throttling (Requirement 9)
    if (this.rateLimitRemaining <= 5) {
      const now = Date.now();
      const waitTime = this.rateLimitReset - now;
      if (waitTime > 0) {
        // If limit is fully exhausted, fail gracefully instead of sleeping worker forever (Requirement 10)
        if (this.rateLimitRemaining === 0) {
          console.error(`[GitHub Quota Exhausted] Remaining: 0. Quota resets in ${(waitTime / 1000).toFixed(0)}s`);
          throw new Error("GitHub rate limit completely exhausted. Postponing analysis.");
        }

        console.warn(`[GitHub Rate Limit Alert] Approaching zero remaining. Throttling request for ${(waitTime / 1000).toFixed(1)}s`);
        await new Promise(r => setTimeout(r, Math.min(waitTime, 10000))); // Throttle up to 10 seconds max
      }
    }

    const promise = this.executeFetch<T>(url, options, cacheKey, ttlSeconds);
    this.pendingPromises.set(cacheKey, promise);
    return promise;
  }

  private async executeFetch<T>(url: string, options: RequestInit, cacheKey: string, ttlSeconds: number): Promise<T> {
    const startTime = Date.now();
    const token = process.env.GITHUB_TOKEN;

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('User-Agent', 'DebtRadar-Client');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout limit

    let attempts = 3;
    let delay = 1000;

    try {
      while (attempts > 0) {
        try {
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
          });

          // Centralized Quota Rate Limit Tracking (Requirement 9)
          const remaining = response.headers.get('x-ratelimit-remaining');
          const reset = response.headers.get('x-ratelimit-reset');
          if (remaining !== null) this.rateLimitRemaining = parseInt(remaining, 10);
          if (reset !== null) this.rateLimitReset = parseInt(reset, 10) * 1000;

          // Request Duration & Quota Instrumentation Logging (Requirement 13)
          const duration = Date.now() - startTime;
          console.log(`[GitHub API] GET ${url} - Status ${response.status} - Duration ${duration}ms - Quota Remaining: ${this.rateLimitRemaining}`);

          if (response.status === 401) {
            console.warn(`[GitHub API] Supplied token is invalid (401 Unauthorized) for GET ${url}. Gracefully retrying unauthenticated...`);
            headers.delete('Authorization');
            attempts--;
            if (attempts === 0) {
              throw new Error("GitHub API returned 401 Unauthorized. Unauthenticated retry also failed.");
            }
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          }

          if (response.status === 403 || response.status === 429) {
            const wait = Math.max(this.rateLimitReset - Date.now(), 5000);
            throw new Error(`GitHub rate limit exhausted. Reset in ${(wait / 1000).toFixed(0)} seconds.`);
          }

          if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          // Save to Cache
          this.cache.set(cacheKey, {
            data,
            expiry: Date.now() + ttlSeconds * 1000
          });

          return data as T;

        } catch (err) {
          attempts--;
          const isRateLimit = err instanceof Error && err.message.includes('rate limit');
          const isAuthError = err instanceof Error && (err.message.includes('401') || err.message.includes('Unauthorized'));
          if (attempts === 0 || isRateLimit || isAuthError) {
            throw err;
          }
          console.warn(`[GitHub Retry] Request failed. Retrying in ${delay}ms...`, err);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
      throw new Error(`Failed to query GitHub endpoint: ${url}`);
    } finally {
      clearTimeout(timeoutId);
      this.pendingPromises.delete(cacheKey);
    }
  }
}

export const githubClient = new GitHubClient();

function getExtension(path: string): string {
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.slice(idx).toLowerCase() : '';
}

// Strict filter checker (Requirement 14)
function isValidFile(path: string, size: number): boolean {
  const lowercasePath = path.toLowerCase();
  
  if (PROBLEMATIC_PATHS.some(dir => lowercasePath.includes(dir))) {
    return false;
  }

  const filename = path.split('/').pop() || '';
  if (PROBLEMATIC_FILES.includes(filename.toLowerCase())) {
    return false;
  }

  if (filename.includes('.min.')) {
    return false;
  }

  const ext = getExtension(path);
  if (PROBLEMATIC_EXTENSIONS.has(ext)) {
    return false;
  }

  if (!JS_EXTENSIONS.has(ext)) {
    return false;
  }

  if (size > MAX_FILE_SIZE) {
    return false;
  }

  return true;
}

// BFS Directory walking fallback using Cache
async function fetchTreeBFS(owner: string, repo: string, branch: string): Promise<any[]> {
  const allItems: any[] = [];
  const queue: string[] = ['']; // BFS queue
  let calls = 0;
  const MAX_CALLS = 25;

  while (queue.length > 0 && calls < MAX_CALLS) {
    const dir = queue.shift()!;
    calls++;
    console.log(`[GitHub] BFS walking directory: "${dir}" (call ${calls}/${MAX_CALLS})`);
    
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${branch}`;
    try {
      const items = await githubClient.fetchJson<any[]>(url, {}, 600);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.type === 'dir') {
            queue.push(item.path);
          } else if (item.type === 'file') {
            allItems.push({
              path: item.path,
              type: 'blob',
              sha: item.sha,
              size: item.size
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[GitHub] BFS failed for directory "${dir}":`, err);
    }
  }

  return allItems;
}

/**
 * Production-grade repository crawler featuring raw content optimizations and strict filtering (Requirement 5)
 */
export async function fetchRepositoryFiles(
  owner: string,
  repo: string,
  onProgress?: (message: string) => Promise<void>
): Promise<ParsedFile[]> {
  console.log("[GitHub] Fetching repo metadata...");
  if (onProgress) await onProgress("Fetching repository metadata...");

  const repoMeta = await githubClient.fetchJson<any>(`https://api.github.com/repos/${owner}/${repo}`, {}, 600);
  const sizeKB = repoMeta.size ?? 0;
  console.log(`[GitHub] Repository size: ${(sizeKB / 1024).toFixed(2)} MB, Private: ${repoMeta.private}`);

  if (sizeKB > 100000) {
    throw new Error(`Repository size too large: ${(sizeKB / 1024).toFixed(1)}MB exceeds the 100MB limit.`);
  }

  let branch = repoMeta.default_branch || 'main';
  console.log("[GitHub] Default branch:", branch);

  console.log("[GitHub] Fetching tree...");
  if (onProgress) await onProgress(`Fetching file tree for branch '${branch}'...`);

  let allItems: any[] = [];
  try {
    const treeData = await githubClient.fetchJson<any>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {}, 300);
    allItems = treeData.tree ?? [];
  } catch (recursiveErr) {
    console.warn(`[GitHub] Recursive tree fetch failed, falling back to BFS traversal:`, recursiveErr);
    if (onProgress) await onProgress("Recursive tree fetch blocked. BFS traversing directories...");
    allItems = await fetchTreeBFS(owner, repo, branch);
  }

  console.log("[GitHub] Files found in tree:", allItems.length);
  if (onProgress) await onProgress(`Found ${allItems.length} total files. Filtering sources...`);

  if (allItems.length > 5000) {
    throw new Error(`Repository contains ${allItems.length} files, which exceeds the limit of 5000 files.`);
  }

  const validBlobs = allItems.filter(item => {
    if (item.type !== 'blob' || !item.path) return false;
    return isValidFile(item.path, item.size ?? 0);
  });

  console.log(`[GitHub] Filtered to ${validBlobs.length} valid source files`);
  const blobsToFetch = validBlobs.slice(0, MAX_FILES);

  const files: ParsedFile[] = [];
  const CONCURRENCY_LIMIT = 5; // Concurrency limit of 5 (Requirement 8)

  const isPublic = !repoMeta.private;

  for (let i = 0; i < blobsToFetch.length; i += CONCURRENCY_LIMIT) {
    const batch = blobsToFetch.slice(i, i + CONCURRENCY_LIMIT);
    
    if (onProgress) {
      await onProgress(`Downloading files [${i + 1}-${Math.min(i + CONCURRENCY_LIMIT, blobsToFetch.length)} of ${blobsToFetch.length}]...`);
    }

    await Promise.all(
      batch.map(async (blob) => {
        if (!blob.path) return;
        
        let content: string | null = null;

        // Optimized raw.githubusercontent.com path for public repositories (Requirement 21)
        if (isPublic) {
          try {
            content = await fetchRawGithubFile(owner, repo, blob.path, branch);
          } catch (rawErr) {
            console.warn(`[GitHub Raw] Failed to download public file directly: ${blob.path}, falling back to REST API`, rawErr);
          }
        }

        // Fallback or Private Repos path
        if (content === null && blob.sha) {
          try {
            const blobData = await githubClient.fetchJson<any>(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${blob.sha}`, {}, 600);
            if (blobData.encoding === 'base64' && blobData.content) {
              content = Buffer.from(blobData.content, 'base64').toString('utf-8');
            }
          } catch (err) {
            console.error(`[GitHub] Failed downloading blob ${blob.path} via API:`, err);
          }
        }

        if (content !== null && content.trim().length > 0) {
          files.push({ path: blob.path, content });
        }
      })
    );
  }

  const { remaining } = githubClient.getRateLimits();
  console.log("[GitHub] Download batch complete. API Quota remaining:", remaining);
  return files;
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const repoMeta = await githubClient.fetchJson<any>(`https://api.github.com/repos/${owner}/${repo}`, {}, 600);
  return repoMeta.default_branch ?? 'main';
}

export async function fetchRawGithubFile(
  owner: string,
  repo: string,
  path: string,
  branch = 'main'
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[GitHub] Failed to fetch raw file directly from ${url}:`, err);
    return null;
  }
}
