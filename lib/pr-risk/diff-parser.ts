export interface ParsedDiffFile {
  path: string;
  additions: number;
  deletions: number;
  hunks: Array<{ start: number; count: number }>;
  content: string;
}

export function parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
  const files: ParsedDiffFile[] = [];
  const chunks = diffText.split(/^diff --git /m).map((chunk) => chunk.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const match = chunk.match(/^a\/(.+?)\s+b\/(.+?)\n/);
    const path = match?.[2] ?? '';
    if (!path) continue;

    const hunks = [...chunk.matchAll(/^@@\s-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm)].map((item) => ({
      start: Number(item[1]),
      count: Number(item[2] ?? '1'),
    }));

    const additions = (chunk.match(/^\+/gm) ?? []).length;
    const deletions = (chunk.match(/^-/gm) ?? []).length;

    files.push({
      path,
      additions,
      deletions,
      hunks,
      content: chunk,
    });
  }

  return files;
}
