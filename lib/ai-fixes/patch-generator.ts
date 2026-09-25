import { buildUnifiedDiff } from '@/lib/ai-fixes/diff-builder';
import { buildRemediationPrompt } from '@/lib/ai-fixes/remediation-prompts';
import type { AutoFixResult, SecurityFinding } from '@/types';

const HF_API = 'https://api-inference.huggingface.co/models';
const FIX_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const FALLBACK_MODEL = 'HuggingFaceH4/zephyr-7b-beta';

async function callHF(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY is missing');

  const response = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 500 } }),
  });

  const raw = await response.text();
  if (!response.ok) {
    if (response.status === 503 && model !== FALLBACK_MODEL) {
      return callHF(FALLBACK_MODEL, prompt);
    }
    throw new Error(raw);
  }

  try {
    const data = JSON.parse(raw) as Array<{ generated_text?: string }>;
    return (data[0]?.generated_text ?? '').trim();
  } catch {
    return raw.trim();
  }
}

export async function generateAutofix(params: {
  filePath: string;
  symbolName: string;
  codeSnippet: string;
  finding: SecurityFinding;
}): Promise<AutoFixResult> {
  const prompt = buildRemediationPrompt(params);

  try {
    const raw = await callHF(FIX_MODEL, prompt);
    const jsonText = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<AutoFixResult> & { confidence?: number };
    const beforeCode = parsed.beforeCode ?? params.codeSnippet;
    const afterCode = parsed.afterCode ?? params.codeSnippet;

    return {
      summary: parsed.summary ?? `Harden ${params.symbolName}`,
      risk: parsed.risk ?? params.finding.severity,
      beforeCode,
      afterCode,
      patch: buildUnifiedDiff(beforeCode, afterCode, params.filePath),
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.75)),
      estimatedRiskReduction: 25,
    };
  } catch {
    const beforeCode = params.codeSnippet;
    const afterCode = beforeCode.replace(/eval\(/g, '/* removed eval */(').replace(/dangerouslySetInnerHTML/g, '');
    return {
      summary: `Heuristic fix for ${params.finding.title}`,
      risk: params.finding.severity,
      beforeCode,
      afterCode,
      patch: buildUnifiedDiff(beforeCode, afterCode, params.filePath),
      confidence: 0.45,
      estimatedRiskReduction: 15,
    };
  }
}
