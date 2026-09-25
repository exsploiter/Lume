export function buildUnifiedDiff(beforeCode: string, afterCode: string, filePath = 'file.ts'): string {
  const beforeLines = beforeCode.split(/\r?\n/);
  const afterLines = afterCode.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const body: string[] = [`diff --git a/${filePath} b/${filePath}`, `--- a/${filePath}`, `+++ b/${filePath}`, '@@'];

  for (let index = 0; index < max; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      body.push(` ${beforeLine ?? ''}`);
      continue;
    }
    if (beforeLine !== undefined) body.push(`-${beforeLine}`);
    if (afterLine !== undefined) body.push(`+${afterLine}`);
  }

  return body.join('\n');
}
