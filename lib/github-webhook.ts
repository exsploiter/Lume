import crypto from 'crypto';

export interface GitHubPushPayload {
  ref: string;
  after: string;
  before: string;
  compare?: string;
  pusher?: {
    name: string;
    email?: string;
  };
  sender?: {
    login: string;
    avatar_url?: string;
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      name?: string;
      login: string;
    };
    html_url: string;
    clone_url: string;
    default_branch: string;
    private: boolean;
  };
  head_commit?: {
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
    };
  };
}

export interface GitHubPullRequestPayload {
  action: 'opened' | 'synchronize' | 'reopened' | 'closed' | 'edited' | string;
  number: number;
  sender?: {
    login: string;
    avatar_url?: string;
  };
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    html_url: string;
    diff_url?: string;
    head: {
      sha: string;
      ref: string;
      repo?: {
        name: string;
        full_name: string;
        owner: {
          login: string;
        };
      };
    };
    base: {
      sha: string;
      ref: string;
    };
    user: {
      login: string;
      avatar_url?: string;
    };
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
    html_url: string;
    default_branch: string;
  };
}

export interface GitHubPingPayload {
  zen: string;
  hook_id: number;
  hook?: Record<string, unknown>;
  repository?: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export interface ParsedWebhookEvent {
  event: string;
  action?: string;
  owner: string;
  repo: string;
  repoUrl: string;
  commitSha: string;
  branch: string;
  prNumber?: number;
  sender?: string;
  isDefaultBranch?: boolean;
}

/**
 * Validates the HMAC-SHA256 signature sent by GitHub in the X-Hub-Signature-256 header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[GitHub Webhook Security] GITHUB_WEBHOOK_SECRET is not configured in production. Rejecting request.');
      return false;
    }
    console.warn('[GitHub Webhook Security] Warning: GITHUB_WEBHOOK_SECRET is not set. Allowing request in non-production mode.');
    return true;
  }

  if (!signatureHeader) {
    console.warn('[GitHub Webhook Security] Missing X-Hub-Signature-256 header.');
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.warn('[GitHub Webhook Security] Invalid signature header format. Expected sha256=...');
    return false;
  }

  const signature = parts[1];
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = hmac.update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const digestBuffer = Buffer.from(digest, 'hex');

  if (signatureBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
}

/**
 * Extracts unified analysis target metadata from a GitHub webhook event payload.
 */
export function parseWebhookEvent(
  eventType: string,
  payload: any
): ParsedWebhookEvent | null {
  if (eventType === 'push') {
    const push = payload as GitHubPushPayload;
    if (!push.repository || !push.ref) return null;

    // Ignore tag pushes and branch deletions
    if (push.ref.startsWith('refs/tags/') || push.after === '0000000000000000000000000000000000000000') {
      return null;
    }

    const branch = push.ref.replace('refs/heads/', '');
    const owner = push.repository.owner.login || push.repository.owner.name || '';
    const repo = push.repository.name;
    const commitSha = push.after || push.head_commit?.id || '';
    const repoUrl = push.repository.html_url || `https://github.com/${owner}/${repo}`;
    const isDefaultBranch = branch === push.repository.default_branch;

    return {
      event: 'push',
      owner,
      repo,
      repoUrl,
      commitSha,
      branch,
      sender: push.pusher?.name || push.sender?.login || 'github',
      isDefaultBranch,
    };
  }

  if (eventType === 'pull_request') {
    const pr = payload as GitHubPullRequestPayload;
    if (!pr.repository || !pr.pull_request) return null;

    const supportedActions = ['opened', 'synchronize', 'reopened'];
    if (!supportedActions.includes(pr.action)) {
      return null;
    }

    const owner = pr.repository.owner.login;
    const repo = pr.repository.name;
    const commitSha = pr.pull_request.head.sha;
    const branch = pr.pull_request.head.ref;
    const repoUrl = pr.repository.html_url || `https://github.com/${owner}/${repo}`;

    return {
      event: 'pull_request',
      action: pr.action,
      owner,
      repo,
      repoUrl,
      commitSha,
      branch,
      prNumber: pr.number,
      sender: pr.sender?.login || pr.pull_request.user?.login || 'github',
      isDefaultBranch: false,
    };
  }

  return null;
}
