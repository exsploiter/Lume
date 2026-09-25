export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$|\?)/i,
    /^([^/]+)\/([^/]+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return {
        owner: match[1].replace(/\.git$/, ''),
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#e16a4f'; // CRITICAL NODE: #e16a4f
  if (score >= 50) return '#f0a03c'; // HIGH NODE: #f0a03c
  if (score >= 25) return '#f1c04e'; // MEDIUM NODE: #f1c04e
  return '#93ab68';                  // SUCCESS NODE: #93ab68
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function symbolId(filePath: string, name: string): string {
  return `${filePath}::${name}`;
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
