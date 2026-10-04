import { Octokit } from 'octokit';

export type CommitStatusState = 'pending' | 'success' | 'failure' | 'error';

export interface CommitStatusParams {
  owner: string;
  repo: string;
  sha: string;
  state: CommitStatusState;
  description: string;
  targetUrl?: string;
  context?: string;
  token?: string;
}

export interface CheckRunParams {
  owner: string;
  repo: string;
  headSha: string;
  name?: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  title: string;
  summary: string;
  text?: string;
  detailsUrl?: string;
  token?: string;
}

export interface PRCommentParams {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
  token?: string;
}

function getClient(explicitToken?: string): Octokit | null {
  const token = explicitToken || process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[GitHub Status Reporter] GITHUB_TOKEN is not configured. GitHub status updates skipped.');
    return null;
  }
  return new Octokit({ auth: token });
}

/**
 * Creates or updates a GitHub Commit Status for a specific commit SHA.
 */
export async function createCommitStatus(params: CommitStatusParams): Promise<boolean> {
  const octokit = getClient(params.token);
  if (!octokit) return false;

  const context = params.context || 'debtradar/risk-gate';
  // GitHub status description has a hard 140 character limit
  const description = params.description.length > 140
    ? `${params.description.slice(0, 137)}...`
    : params.description;

  try {
    console.log(`[GitHub Status Reporter] Setting commit status for ${params.owner}/${params.repo}@${params.sha.slice(0, 7)}: ${params.state}`);
    await octokit.rest.repos.createCommitStatus({
      owner: params.owner,
      repo: params.repo,
      sha: params.sha,
      state: params.state,
      description,
      target_url: params.targetUrl,
      context,
    });
    return true;
  } catch (error) {
    console.error(`[GitHub Status Reporter] Failed to set commit status for ${params.sha}:`, error);
    return false;
  }
}

/**
 * Posts or updates a Check Run on GitHub (useful for GitHub App installations).
 */
export async function createOrUpdateCheckRun(params: CheckRunParams): Promise<number | null> {
  const octokit = getClient(params.token);
  if (!octokit) return null;

  const name = params.name || 'DebtRadar / Quality & Security Gate';

  try {
    console.log(`[GitHub Check Run] Reporting check run ${params.status} (${params.conclusion || 'running'}) on ${params.headSha.slice(0, 7)}`);
    const res = await octokit.rest.checks.create({
      owner: params.owner,
      repo: params.repo,
      name,
      head_sha: params.headSha,
      status: params.status,
      conclusion: params.status === 'completed' ? (params.conclusion || 'neutral') : undefined,
      details_url: params.detailsUrl,
      output: {
        title: params.title,
        summary: params.summary,
        text: params.text,
      },
    });
    return res.data.id;
  } catch (error) {
    console.warn('[GitHub Check Run] Check Run API unavailable or lacked permissions; fallback to Commit Status:', error);
    return null;
  }
}

const PR_COMMENT_IDENTIFIER = '<!-- debtradar-risk-gate -->';

/**
 * Posts or updates a sticky DebtRadar Risk Gate review comment on a Pull Request.
 */
export async function postOrUpdatePRComment(params: PRCommentParams): Promise<boolean> {
  const octokit = getClient(params.token);
  if (!octokit) return false;

  const formattedBody = `${PR_COMMENT_IDENTIFIER}\n${params.body}`;

  try {
    // 1. Search existing comments to see if DebtRadar has already commented
    console.log(`[GitHub PR Comment] Checking existing comments for PR #${params.pullNumber} in ${params.owner}/${params.repo}`);
    const comments = await octokit.rest.issues.listComments({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.pullNumber,
      per_page: 50,
    });

    const existingComment = comments.data.find(
      (c) => c.body && c.body.includes(PR_COMMENT_IDENTIFIER)
    );

    if (existingComment) {
      console.log(`[GitHub PR Comment] Updating existing comment #${existingComment.id} on PR #${params.pullNumber}`);
      await octokit.rest.issues.updateComment({
        owner: params.owner,
        repo: params.repo,
        comment_id: existingComment.id,
        body: formattedBody,
      });
      return true;
    }

    // 2. Create new comment
    console.log(`[GitHub PR Comment] Creating new gate comment on PR #${params.pullNumber}`);
    await octokit.rest.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.pullNumber,
      body: formattedBody,
    });
    return true;
  } catch (error) {
    console.error(`[GitHub PR Comment] Failed to post/update comment on PR #${params.pullNumber}:`, error);
    return false;
  }
}
