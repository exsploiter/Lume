import fs from 'fs';
import path from 'path';
import type { ParsedFile } from '@/types';

export interface FileSnapshot {
  path: string;
  sha: string;
  content: string;
  symbols?: any[];
}

export interface RepoSnapshot {
  owner: string;
  repo: string;
  branch: string;
  commitSha?: string;
  updatedAt: number;
  files: Record<string, FileSnapshot>;
}

const CACHE_DIR = path.join(process.cwd(), 'data', 'incremental_cache');

function getCacheFilePath(owner: string, repo: string): string {
  const safeOwner = owner.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRepo = repo.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safeOwner}__${safeRepo}.json`);
}

function ensureDirExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch {
    // ignore
  }
}

// Memory cache for quick in-process hits
const memorySnapshots = new Map<string, RepoSnapshot>();

export async function getRepoSnapshot(owner: string, repo: string): Promise<RepoSnapshot | null> {
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  if (memorySnapshots.has(key)) {
    return memorySnapshots.get(key)!;
  }

  try {
    const filePath = getCacheFilePath(owner, repo);
    if (fs.existsSync(filePath)) {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const snapshot = JSON.parse(raw) as RepoSnapshot;
      memorySnapshots.set(key, snapshot);
      return snapshot;
    }
  } catch (err) {
    console.warn(`[Incremental Cache] Could not load snapshot for ${owner}/${repo}:`, err);
  }

  return null;
}

export async function saveRepoSnapshot(
  owner: string,
  repo: string,
  branch: string,
  filesWithSha: Array<{ path: string; sha: string; content: string }>,
  symbolsByFile?: Map<string, any[]>,
  commitSha?: string
): Promise<void> {
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const filesRecord: Record<string, FileSnapshot> = {};

  for (const f of filesWithSha) {
    filesRecord[f.path] = {
      path: f.path,
      sha: f.sha,
      content: f.content,
      symbols: symbolsByFile?.get(f.path) ?? [],
    };
  }

  const snapshot: RepoSnapshot = {
    owner,
    repo,
    branch,
    commitSha,
    updatedAt: Date.now(),
    files: filesRecord,
  };

  memorySnapshots.set(key, snapshot);

  try {
    ensureDirExists(CACHE_DIR);
    const filePath = getCacheFilePath(owner, repo);
    await fs.promises.writeFile(filePath, JSON.stringify(snapshot), 'utf-8');
    console.log(`[Incremental Cache] Successfully saved snapshot for ${owner}/${repo} (${filesWithSha.length} files)`);
  } catch (err) {
    console.warn(`[Incremental Cache] Failed to persist snapshot to disk for ${owner}/${repo}:`, err);
  }
}

export interface IncrementalDiffResult {
  reusedFiles: ParsedFile[];
  reusedSymbols: any[];
  changedBlobs: Array<{ path: string; sha: string; size?: number }>;
  isIncremental: boolean;
  totalTreeFiles: number;
}

/**
 * Compares incoming tree items with previous snapshot to find unmodified vs modified files
 */
export function diffTreeWithSnapshot(
  treeItems: Array<{ path: string; sha: string; size?: number }>,
  snapshot: RepoSnapshot | null
): IncrementalDiffResult {
  if (!snapshot || !snapshot.files) {
    return {
      reusedFiles: [],
      reusedSymbols: [],
      changedBlobs: treeItems,
      isIncremental: false,
      totalTreeFiles: treeItems.length,
    };
  }

  const reusedFiles: ParsedFile[] = [];
  const reusedSymbols: any[] = [];
  const changedBlobs: Array<{ path: string; sha: string; size?: number }> = [];

  for (const item of treeItems) {
    const cached = snapshot.files[item.path];
    if (cached && cached.sha === item.sha && cached.content) {
      reusedFiles.push({
        path: cached.path,
        content: cached.content,
      });
      if (cached.symbols && Array.isArray(cached.symbols)) {
        reusedSymbols.push(...cached.symbols);
      }
    } else {
      changedBlobs.push(item);
    }
  }

  return {
    reusedFiles,
    reusedSymbols,
    changedBlobs,
    isIncremental: reusedFiles.length > 0,
    totalTreeFiles: treeItems.length,
  };
}
