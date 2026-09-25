const HF_API = 'https://api-inference.huggingface.co/models';

const EXPLANATION_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const FINGERPRINT_MODEL = 'google/flan-t5-large';
const FALLBACK_MODEL = 'HuggingFaceH4/zephyr-7b-beta';

const AGENT_LABELS = [
  'legacy-spaghetti',
  'god-object',
  'callback-hell',
  'copy-paste-clone',
  'dead-code',
  'over-engineered',
  'tight-coupling',
  'missing-abstraction',
];

interface HFTextResponse {
  generated_text?: string;
  error?: string;
}

async function callHF(
  model: string,
  inputs: string,
  options?: { max_new_tokens?: number; wait_for_model?: boolean }
): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('Environment variable HUGGINGFACE_API_KEY is missing or undefined');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout (Requirement 14)

  try {
    const response = await fetch(`${HF_API}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        parameters: {
          max_new_tokens: options?.max_new_tokens ?? 300, // Default to 300 (Requirement 5)
        },
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log("[Explain] Response status:", response.status);

    const text = await response.text();
    console.log("[Explain] Response text:", text);

    if (!response.ok) {
      if (response.status === 503 && model !== FALLBACK_MODEL) {
        console.warn(`[HuggingFace] Model 503 unavailable. Retrying with fallback model...`);
        return callHF(FALLBACK_MODEL, inputs, options);
      }
      throw new Error(`HF API Error ${response.status}: ${text}`);
    }

    let data: any;
    try {
      data = JSON.parse(text) as HFTextResponse[] | HFTextResponse;
    } catch (parseErr) {
      throw new Error(`Failed to parse HuggingFace response as JSON: ${text}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (result?.error) throw new Error(result.error);
    return (result?.generated_text ?? '').trim();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function generateHeuristicExplanation(context: {
  filePath: string;
  symbolName: string;
  debtScore: number;
  complexity: number;
  blastRadius: number;
}): string {
  const parts: string[] = [];
  const filename = context.filePath.split('/').pop() || 'file';
  
  if (context.debtScore > 75) {
    parts.push(`The symbol '${context.symbolName}' in ${filename} represents critical technical debt with a score of ${context.debtScore}/100.`);
  } else if (context.debtScore > 50) {
    parts.push(`The symbol '${context.symbolName}' in ${filename} carries moderate technical debt with a score of ${context.debtScore}/100.`);
  } else {
    parts.push(`The symbol '${context.symbolName}' in ${filename} is well-structured with a low technical debt score of ${context.debtScore}/100.`);
  }

  if (context.complexity > 15) {
    parts.push(`It has highly complex logic structure (cyclomatic complexity ${context.complexity}), making it prone to errors during updates.`);
  } else if (context.complexity > 5) {
    parts.push(`It contains moderate logical branching (complexity ${context.complexity}) which warrants sub-routine extraction.`);
  }

  if (context.blastRadius > 5) {
    parts.push(`A massive blast radius of ${context.blastRadius} means this node has tight coupling across the system; changing it presents a major regression risk.`);
  } else if (context.blastRadius > 0) {
    parts.push(`Its blast radius of ${context.blastRadius} indicates localized coupling with moderate ripple effect risks.`);
  } else {
    parts.push(`With a blast radius of 0, this node is isolated and highly safe to modify or refactor without side effects.`);
  }

  parts.push(`We recommend extracting complex branching sections and consolidating duplicate helper logic to improve readability.`);
  
  return parts.join(' ');
}

export async function generateDebtExplanation(context: {
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
}): Promise<string> {
  // Truncate fields to verify and handle token limits (Requirement 16)
  const truncatedPath = (context.filePath || '').slice(0, 200);
  const truncatedSymbol = (context.symbolName || '').slice(0, 100);
  const truncatedCode = (context.codeSnippet || '').slice(0, 1000);
  const securitySummary = [
    `Security score: ${context.securityScore ?? 0}/100`,
    `Vulnerabilities: ${context.vulnerabilityCount ?? 0}`,
    `Risk level: ${context.securityRiskLevel ?? 'none'}`,
    `OWASP: ${(context.owaspCategories ?? []).join(', ') || 'none'}`,
    `CWE: ${(context.cweCategories ?? []).join(', ') || 'none'}`,
  ].join('\n');
  const securityFindings = (context.securityFindings ?? [])
    .slice(0, 6)
    .map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.evidence}`)
    .join('\n');

  const prompt = `<s>[INST] You are a senior software architect.

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
Debt Score: ${context.debtScore}/100
Complexity: ${context.complexity}
Blast Radius: ${context.blastRadius} dependent symbols
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
  try {
    const raw = await callHF(EXPLANATION_MODEL, prompt, { max_new_tokens: 380 });
    const parsed = parseSecurityExplanation(raw);
    if (parsed) return parsed;
    return raw;
  } catch (err) {
    console.warn("[HuggingFace] Primary model failed due to offline state or timeout. Attempting fallback model...");
    try {
      const fallbackPrompt = `Explain this symbol for engineers only. Focus on code-level behavior, root cause, technical risk, and concrete fixes.

Symbol: ${truncatedSymbol}
File: ${truncatedPath}
Score: ${context.debtScore}
Code: ${truncatedCode.slice(0, 400)}`;
      const raw = await callHF(FALLBACK_MODEL, fallbackPrompt, { max_new_tokens: 150 });
      const parsed = parseSecurityExplanation(raw);
      return parsed ?? raw;
    } catch (fallbackErr) {
      console.warn("[HuggingFace] Fallback model also failed (network unreachable). Gracefully fallback to custom local heuristic explanation.");
      return generateSecurityHeuristicExplanation(context);
    }
  }
}

function parseSecurityExplanation(raw: string): string | null {
  const trimmed = raw.trim();
  const jsonCandidate = trimmed.startsWith('```') ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : trimmed;

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      summary?: string;
      rootCause?: string;
      technicalRisk?: string;
      codeLevelImpact?: string;
      recommendedFixes?: string[];
      priorityLevel?: string;
    };
    const sections = [
      parsed.summary ? `Summary: ${parsed.summary}` : '',
      parsed.rootCause ? `Root cause: ${parsed.rootCause}` : '',
      parsed.technicalRisk ? `Technical risk: ${parsed.technicalRisk}` : '',
      parsed.codeLevelImpact ? `Code impact: ${parsed.codeLevelImpact}` : '',
      parsed.priorityLevel ? `Priority: ${parsed.priorityLevel}` : '',
      parsed.recommendedFixes?.length ? `Recommended fixes: ${parsed.recommendedFixes.join('; ')}` : '',
    ].filter(Boolean);

    return sections.join('\n');
  } catch {
    return null;
  }
}

function generateSecurityHeuristicExplanation(context: {
  filePath: string;
  symbolName: string;
  debtScore: number;
  complexity: number;
  blastRadius: number;
  securityScore?: number;
  vulnerabilityCount?: number;
  securityRiskLevel?: string;
}): string {
  const securityLines = [
    `Security score: ${context.securityScore ?? 0}/100`,
    `Vulnerability count: ${context.vulnerabilityCount ?? 0}`,
    `Risk level: ${context.securityRiskLevel ?? 'none'}`,
    `Blast radius: ${context.blastRadius}`,
    `Technical implication: ${context.blastRadius > 5 ? 'This spreads through multiple dependent code paths.' : 'This is mostly localized to a smaller code path.'}`,
  ];

  return `${generateHeuristicExplanation(context)} ${securityLines.join('. ')}. Prioritize remediation in the highest blast-radius paths first.`;
}

export async function classifyAgentCode(codeSnippet: string): Promise<{
  label: string;
  confidence: number;
}> {
  const labelsStr = AGENT_LABELS.join(', ');
  const prompt = `Classify this code snippet into exactly one technical debt category from: ${labelsStr}. Reply with only the category name.

Code:
${codeSnippet.slice(0, 800)}`;

  try {
    const result = await callHF(FINGERPRINT_MODEL, prompt, {
      max_new_tokens: 32,
    });
    const normalized = result.toLowerCase().trim();
    const matched = AGENT_LABELS.find((l) => normalized.includes(l.replace(/-/g, '')) || normalized.includes(l));
    if (matched) {
      return { label: matched, confidence: 0.85 };
    }
    return { label: normalized || 'legacy-spaghetti', confidence: 0.6 };
  } catch {
    return heuristicFingerprint(codeSnippet);
  }
}

function heuristicFingerprint(code: string): { label: string; confidence: number } {
  const lines = code.split('\n');
  if (code.match(/function\s*\([^)]*\)\s*{[^}]*function/g)) {
    return { label: 'callback-hell', confidence: 0.7 };
  }
  if (lines.length > 200) return { label: 'god-object', confidence: 0.65 };
  if ((code.match(/if\s*\(/g) || []).length > 15) {
    return { label: 'legacy-spaghetti', confidence: 0.6 };
  }
  if ((code.match(/import|require/g) || []).length > 20) {
    return { label: 'tight-coupling', confidence: 0.55 };
  }
  return { label: 'missing-abstraction', confidence: 0.5 };
}
