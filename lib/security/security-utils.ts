import type { SecurityFinding, VulnerabilitySeverity } from '@/types';

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function severityRank(severity: VulnerabilitySeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function highestSeverity(findings: SecurityFinding[]): VulnerabilitySeverity | 'none' {
  if (findings.length === 0) return 'none';
  return [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0].severity;
}

export function isTestLikePath(filePath: string): boolean {
  return /(?:^|\/)(?:test|tests|spec|__tests__|mock|mocks|fixture|fixtures|sample|examples?)(?:\/|$)/i.test(filePath);
}

export function isProductionPath(filePath: string): boolean {
  return !isTestLikePath(filePath);
}

export function isSecuritySensitivePath(filePath: string): boolean {
  return /(?:auth|security|login|session|token|jwt|oauth|password|sso|crypto|tls|cors|middleware|gateway|api\b)/i.test(filePath);
}

export function lineAt(content: string, lineNumber: number): string {
  return content.split(/\r?\n/)[Math.max(0, lineNumber - 1)] ?? '';
}

export function locateLineRange(content: string, needle: string): { start: number; end: number } {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  if (index === -1) {
    return { start: 1, end: Math.min(lines.length, 1) };
  }
  return { start: index + 1, end: index + 1 };
}

export function countOccurrences(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches?.length ?? 0;
}

export function makeFindingId(ruleId: string, filePath: string, lineStart: number, evidence: string): string {
  const clean = evidence.slice(0, 40).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return [ruleId, filePath, lineStart, clean || 'evidence'].join(':');
}
