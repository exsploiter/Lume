import { logAuditEvent } from './audit-logger';

export interface TokenScopeInfo {
  isValid: boolean;
  isFineGrained: boolean;
  scopes: string[];
  canReadRepo: boolean;
  canCreatePR: boolean;
  userLogin?: string;
  errorMessage?: string;
}

export async function verifyGitHubTokenScope(token?: string): Promise<TokenScopeInfo> {
  const tokenToTest = token || process.env.GITHUB_TOKEN;

  if (!tokenToTest) {
    return {
      isValid: false,
      isFineGrained: false,
      scopes: [],
      canReadRepo: false,
      canCreatePR: false,
      errorMessage: 'GITHUB_TOKEN is missing',
    };
  }

  // Fine-grained personal access tokens start with 'github_pat_'
  const isFineGrained = tokenToTest.startsWith('github_pat_');

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenToTest}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DebtRadar-ScopeChecker',
      },
    });

    if (!res.ok) {
      await logAuditEvent({
        eventType: 'TOKEN_VALIDATION',
        severity: 'warn',
        status: 'failure',
        details: { status: res.status, statusText: res.statusText, isFineGrained },
        error: `GitHub API returned ${res.status}`,
      });

      return {
        isValid: false,
        isFineGrained,
        scopes: [],
        canReadRepo: false,
        canCreatePR: false,
        errorMessage: `Token validation failed with status ${res.status}`,
      };
    }

    const userData = await res.json();
    const scopesHeader = res.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // OAuth & Classic PATs explicitly return scopes in header
    // Fine-grained PATs do not return x-oauth-scopes header, but are valid if user endpoint succeeds
    const canCreatePR = isFineGrained
      ? true
      : scopes.some((s) => s === 'repo' || s === 'public_repo' || s === 'repo_deployment');

    const canReadRepo = true;

    await logAuditEvent({
      eventType: 'TOKEN_VALIDATION',
      severity: 'info',
      status: 'success',
      actor: userData.login,
      details: {
        user: userData.login,
        isFineGrained,
        scopes,
        canCreatePR,
      },
    });

    return {
      isValid: true,
      isFineGrained,
      scopes,
      canReadRepo,
      canCreatePR,
      userLogin: userData.login,
    };
  } catch (err) {
    return {
      isValid: false,
      isFineGrained,
      scopes: [],
      canReadRepo: false,
      canCreatePR: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
