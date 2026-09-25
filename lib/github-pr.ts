import { Octokit } from 'octokit';

interface CreateBranchParams {
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
  token: string;
}

interface UpdateFileParams {
  owner: string;
  repo: string;
  filePath: string;
  fileContent: string;
  sha?: string;
  branchName: string;
  commitMessage: string;
  token: string;
}

interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  token: string;
}

/**
 * Creates a new git branch on the repository.
 */
export async function createBranch(params: CreateBranchParams): Promise<string> {
  const octokit = new Octokit({ auth: params.token });
  
  // 1. Get SHA of base branch
  const refPath = `heads/${params.baseBranch}`;
  console.log(`[GitHub-PR] Fetching ref SHA for base branch: ${params.baseBranch}`);
  const refRes = await octokit.rest.git.getRef({
    owner: params.owner,
    repo: params.repo,
    ref: refPath,
  });
  
  const baseSha = refRes.data.object.sha;
  console.log(`[GitHub-PR] Base branch SHA: ${baseSha}`);

  // 2. Create the branch ref
  console.log(`[GitHub-PR] Creating new branch ref: refs/heads/${params.branchName}`);
  const createRes = await octokit.rest.git.createRef({
    owner: params.owner,
    repo: params.repo,
    ref: `refs/heads/${params.branchName}`,
    sha: baseSha,
  });

  return createRes.data.object.sha;
}

/**
 * Commits updates to a file in a given branch.
 */
export async function updateFile(params: UpdateFileParams): Promise<string> {
  const octokit = new Octokit({ auth: params.token });
  let fileSha = params.sha;

  // Retrieve file SHA if not explicitly provided
  if (!fileSha) {
    try {
      console.log(`[GitHub-PR] Fetching existing file contents to get SHA: ${params.filePath}`);
      const contentRes = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.filePath,
        ref: params.branchName,
      });

      if (!Array.isArray(contentRes.data) && 'sha' in contentRes.data) {
        fileSha = contentRes.data.sha;
        console.log(`[GitHub-PR] Found file SHA: ${fileSha}`);
      }
    } catch (err) {
      console.warn(`[GitHub-PR] File SHA not resolved (might be a new file): ${params.filePath}`, err);
    }
  }

  console.log(`[GitHub-PR] Pushing code update to file: ${params.filePath} on branch: ${params.branchName}`);
  const updateRes = await octokit.rest.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.filePath,
    message: params.commitMessage,
    content: Buffer.from(params.fileContent).toString('base64'),
    sha: fileSha,
    branch: params.branchName,
  });

  return updateRes.data.content?.sha || '';
}

/**
 * Opens a new Pull Request.
 */
export async function createPullRequest(
  params: CreatePRParams
): Promise<{ htmlUrl: string; number: number }> {
  const octokit = new Octokit({ auth: params.token });

  console.log(`[GitHub-PR] Creating pull request from ${params.headBranch} to ${params.baseBranch}`);
  const prRes = await octokit.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.headBranch,
    base: params.baseBranch,
  });

  return {
    htmlUrl: prRes.data.html_url,
    number: prRes.data.number,
  };
}
