import type { AutoFixResult, SecurityFinding } from '@/types';
import { generateAutofix } from '@/lib/ai-fixes/patch-generator';

export async function createSecurityAutofix(params: {
  filePath: string;
  symbolName: string;
  codeSnippet: string;
  finding: SecurityFinding;
}): Promise<AutoFixResult> {
  return generateAutofix(params);
}
