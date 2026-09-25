import type { SecurityFinding } from '@/types';

export function buildRemediationPrompt(params: {
  filePath: string;
  symbolName: string;
  codeSnippet: string;
  finding: SecurityFinding;
}): string {
  return `You are a senior application security engineer.

Fix this vulnerability with the smallest safe change.
Return strict JSON with keys: summary, risk, beforeCode, afterCode, confidence.

File: ${params.filePath}
Symbol: ${params.symbolName}
Finding: ${params.finding.title}
Severity: ${params.finding.severity}
Evidence: ${params.finding.evidence}
Recommendation: ${params.finding.recommendation}

Code:
\`\`\`
${params.codeSnippet.slice(0, 1200)}
\`\`\``;
}
