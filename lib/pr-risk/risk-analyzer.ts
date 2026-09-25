import type { PRRiskResult, SecurityFinding } from '@/types';
import { parseUnifiedDiff } from '@/lib/pr-risk/diff-parser';
import { scoreMergeRisk } from '@/lib/pr-risk/merge-risk';
import { containsAny, normalisePath } from '@/lib/risk-utils';

export function analyzePullRequestRisk(params: {
  diff: string;
  securityFindings: SecurityFinding[];
  criticalFiles: string[];
  repoFiles?: Array<{ path: string; content: string }>;
}): PRRiskResult {
  const files = parseUnifiedDiff(params.diff);
  const touchedCriticalFiles = files.filter((file) =>
    params.criticalFiles.some((critical) => normalisePath(file.path).includes(normalisePath(critical)))
  );

  const unstableChanges = files.flatMap((file) => {
    const warnings: string[] = [];
    if (containsAny(file.content, ['eval(', 'new function', 'dangerouslysetinnerhtml', 'child_process', 'exec('])) {
      warnings.push(`${file.path}: unsafe runtime surface`);
    }
    if (containsAny(file.content, ['TODO', 'FIXME', 'any', 'as unknown as'])) {
      warnings.push(`${file.path}: weak typing or unfinished work`);
    }
    return warnings;
  });

  const newVulnerabilities = params.securityFindings.filter((finding) =>
    files.some((file) => normalisePath(finding.filePath).includes(normalisePath(file.path)) || normalisePath(file.path).includes(normalisePath(finding.filePath)))
  );

  const securityRegression = newVulnerabilities.length > 0 || unstableChanges.length > 0;
  const merge = scoreMergeRisk({
    touchedCriticalFiles: touchedCriticalFiles.length,
    securityRegression,
    newVulnerabilities: newVulnerabilities.length,
    architectureImpact: files.filter((file) => file.additions + file.deletions > 150).length,
    unstableChanges: unstableChanges.length,
  });

  return {
    mergeRisk: merge.mergeRisk,
    riskScore: merge.score,
    securityRegression,
    newVulnerabilities,
    architectureImpact: files.filter((file) => file.additions + file.deletions > 150).map((file) => file.path),
    unstableChanges,
    criticalFilesTouched: touchedCriticalFiles.map((file) => file.path),
    recommendations: [
      'review authentication and authorization deltas',
      're-run security checks on modified public routes',
      'keep merge small when touching critical modules',
    ],
  };
}
