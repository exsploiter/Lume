export interface PromptContext {
  filePath: string;
  symbolName: string;
  debtScore: number;
  complexity: number;
  blastRadius: number;
  codeSnippet: string;
  securityScore?: number;
  vulnerabilityCount?: number;
  securityRiskLevel?: string;
  owaspCategories?: string[];
  cweCategories?: string[];
  securityFindings?: Array<{ title: string; severity: string; recommendation: string; evidence: string }>;
}

export interface PromptDefinition {
  version: string;
  description: string;
  generate: (ctx: PromptContext) => string;
}

export const PROMPT_REGISTRY: Record<string, PromptDefinition> = {
  'v1-baseline': {
    version: 'v1-baseline',
    description: 'Initial freeform developer explanation prompt',
    generate: (ctx) => `Explain this code symbol for engineers:
Symbol: ${ctx.symbolName}
File: ${ctx.filePath}
Debt: ${ctx.debtScore}/100
Complexity: ${ctx.complexity}
Blast Radius: ${ctx.blastRadius}
Code:
${ctx.codeSnippet.slice(0, 500)}`,
  },

  'v2-structured-security': {
    version: 'v2-structured-security',
    description: 'Structured JSON prompt with strict technical-only instructions, security context, and propagation analysis',
    generate: (ctx) => {
      const truncatedPath = (ctx.filePath || '').slice(0, 200);
      const truncatedSymbol = (ctx.symbolName || '').slice(0, 100);
      const truncatedCode = (ctx.codeSnippet || '').slice(0, 1000);
      const securitySummary = [
        `Security score: ${ctx.securityScore ?? 0}/100`,
        `Vulnerabilities: ${ctx.vulnerabilityCount ?? 0}`,
        `Risk level: ${ctx.securityRiskLevel ?? 'none'}`,
        `OWASP: ${(ctx.owaspCategories ?? []).join(', ') || 'none'}`,
        `CWE: ${(ctx.cweCategories ?? []).join(', ') || 'none'}`,
      ].join('\n');

      const securityFindings = (ctx.securityFindings ?? [])
        .slice(0, 6)
        .map((f) => `- [${f.severity}] ${f.title}: ${f.evidence}`)
        .join('\n');

      return `<s>[INST] You are a senior software architect.

Write a technical-only explanation for engineers. Do not mention business impact, customers, executives, or finance.

Analyze this code symbol for technical debt, security vulnerabilities, exploitability, propagation risk, and remediation steps.

Return strict JSON:
{
  "summary": "",
  "rootCause": "",
  "technicalRisk": "",
  "codeLevelImpact": "",
  "recommendedFixes": [],
  "priorityLevel": ""
}

File: ${truncatedPath}
Symbol: ${truncatedSymbol}
Debt Score: ${ctx.debtScore}/100
Complexity: ${ctx.complexity}
Blast Radius: ${ctx.blastRadius} dependent symbols
${securitySummary}

Security Findings:
${securityFindings || '- none'}

Code:
\`\`\`
${truncatedCode}
\`\`\`

Technical writing rules:
- explain the root cause in code terms
- describe the exact failure mode and propagation path
- describe why the issue is hard to maintain or secure
- recommend code-level fixes only

Provide only JSON. [/INST]`;
    },
  },
};

export const ACTIVE_PROMPT_VERSION = 'v2-structured-security';

export function getActivePrompt(ctx: PromptContext, version = ACTIVE_PROMPT_VERSION): { prompt: string; version: string } {
  const def = PROMPT_REGISTRY[version] || PROMPT_REGISTRY[ACTIVE_PROMPT_VERSION];
  return {
    prompt: def.generate(ctx),
    version: def.version,
  };
}
