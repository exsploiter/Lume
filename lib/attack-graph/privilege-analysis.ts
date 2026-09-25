import { containsAny, normalisePath } from '@/lib/risk-utils';

export interface PrivilegeAnalysisResult {
  score: number;
  reasons: string[];
  elevated: boolean;
}

export function analyzePrivilegeEscalation(filePath: string, content = ''): PrivilegeAnalysisResult {
  const normalized = normalisePath(filePath);
  const reasons: string[] = [];
  let score = 0;

  if (containsAny(normalized, ['admin', 'root', 'superuser', 'permissions', 'auth', 'middleware'])) {
    score += 30;
    reasons.push('privileged request gate');
  }

  if (containsAny(content, ['sudo', 'isadmin', 'role ==', 'rbac', 'allowlist', 'permission'])) {
    score += 20;
    reasons.push('role validation branch');
  }

  if (containsAny(content, ['process.env', 'cookie', 'token', 'session'])) {
    score += 10;
    reasons.push('stateful auth context');
  }

  return {
    score: Math.min(100, score),
    reasons,
    elevated: score >= 35,
  };
}
