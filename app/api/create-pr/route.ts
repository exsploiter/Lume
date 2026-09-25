import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { generateSafeFix } from '@/lib/autofix';
import { createBranch, updateFile, createPullRequest } from '@/lib/github-pr';
import { getDefaultBranch, fetchRawGithubFile } from '@/lib/github';
import { getCodeSnippet } from '@/lib/ast-parser';
import { Octokit } from 'octokit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 1. Get user session / token from Supabase Auth & custom cookie
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const cookieToken = request.cookies.get('sb-provider-token')?.value;
    const token = cookieToken || session?.provider_token || process.env.GITHUB_TOKEN;
    const isDummyToken = !token || token.includes('ghp_DebtRadar') || token === 'dummy' || token === 'undefined';

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. No GitHub token found.' },
        { status: 401 }
      );
    }

    // 2. Parse request parameters
    const body = await request.json();
    const {
      repoOwner,
      repoName,
      filePath,
      issueType,
      lineStart,
      lineEnd,
      preflight = false,
      preview = false,
    } = body;

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'Missing required parameters: repoOwner and repoName are required.' },
        { status: 400 }
      );
    }

    if (preflight) {
      if (isDummyToken) {
        return NextResponse.json(
          { error: 'Invalid GitHub token configured. Please set a valid token with repo write permissions before creating a PR.' },
          { status: 401 }
        );
      }

      try {
        const octokit = new Octokit({ auth: token! });
        const repoRes = await octokit.rest.repos.get({ owner: repoOwner, repo: repoName });
        const canPush = Boolean(repoRes.data.permissions?.push);

        if (!canPush) {
          return NextResponse.json(
            { error: `Your GitHub account does not have write access to ${repoOwner}/${repoName}.` },
            { status: 403 }
          );
        }

        return NextResponse.json({
          success: true,
          canCreatePR: true,
          defaultBranch: repoRes.data.default_branch || 'main',
        });
      } catch (preflightErr: any) {
        const status = preflightErr?.status;
        if (status === 401 || status === 403) {
          return NextResponse.json(
            { error: 'GitHub authentication failed or token lacks required repo permissions.' },
            { status: 403 }
          );
        }
        if (status === 404) {
          return NextResponse.json(
            { error: `Repository ${repoOwner}/${repoName} was not found or is not accessible by this token.` },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: `Preflight check failed: ${preflightErr?.message || String(preflightErr)}` },
          { status: 500 }
        );
      }
    }

    if (!filePath || !issueType) {
      return NextResponse.json(
        { error: 'Missing required parameters: repoOwner, repoName, filePath, and issueType are required.' },
        { status: 400 }
      );
    }

    // 3. Resolve default branch
    let defaultBranch = 'main';
    try {
      const octokit = isDummyToken ? new Octokit({}) : new Octokit({ auth: token });
      const repoRes = await octokit.rest.repos.get({ owner: repoOwner, repo: repoName });
      defaultBranch = repoRes.data.default_branch || 'main';
    } catch (e) {
      try {
        defaultBranch = await getDefaultBranch(repoOwner, repoName);
      } catch {
        console.warn(`[API Create-PR] Failed resolving default branch, using fallback 'main':`, e);
      }
    }

    // 4. Fetch the file content from GitHub using Octokit (using authenticated token)
    let originalFileContent = '';
    let fileSha = '';
    let fetchErrToThrow: any = null;

    try {
      const octokit = isDummyToken ? new Octokit({}) : new Octokit({ auth: token });
      
      const contentRes = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: filePath,
        ref: defaultBranch,
      });

      if (!Array.isArray(contentRes.data) && contentRes.data.type === 'file') {
        originalFileContent = Buffer.from(contentRes.data.content, 'base64').toString('utf8');
        fileSha = contentRes.data.sha;
      } else {
        return NextResponse.json(
          { error: `The path: ${filePath} is not a valid file on default branch ${defaultBranch}.` },
          { status: 400 }
        );
      }
    } catch (fetchErr: any) {
      console.warn(`[API Create-PR] Primary content fetch failed, trying unauthenticated raw fetch:`, fetchErr);
      try {
        const rawContent = await fetchRawGithubFile(repoOwner, repoName, filePath, defaultBranch);
        if (rawContent !== null) {
          originalFileContent = rawContent;
          fileSha = 'mock-sha-for-demo';
        } else {
          fetchErrToThrow = fetchErr;
        }
      } catch (rawErr) {
        fetchErrToThrow = fetchErr;
      }
    }

    if (!originalFileContent && fetchErrToThrow) {
      console.error(`[API Create-PR] Failed to retrieve file from GitHub:`, fetchErrToThrow);
      return NextResponse.json(
        { error: `Failed to retrieve file contents from GitHub: ${fetchErrToThrow.message || String(fetchErrToThrow)}` },
        { status: 500 }
      );
    }

    // 5. Generate fixed code snippet or file
    let originalSnippet = '';
    let fixedSnippet = '';
    let fixedFileContent = '';
    let explanation = '';
    let estimatedDebtReduction = 0;

    if (issueType === 'unused_imports') {
      // Unused imports fix is applied file-wide
      const fixResult = generateSafeFix(issueType, originalFileContent);
      originalSnippet = originalFileContent;
      fixedSnippet = fixResult.fixedCode;
      fixedFileContent = fixResult.fixedCode;
      explanation = fixResult.explanation;
      estimatedDebtReduction = fixResult.estimatedDebtReduction;
    } else {
      // Extract specific block snippet
      const lStart = lineStart ? Number(lineStart) : 1;
      const lEnd = lineEnd ? Number(lineEnd) : originalFileContent.split('\n').length;
      originalSnippet = getCodeSnippet(originalFileContent, lStart, lEnd);

      const fixResult = generateSafeFix(issueType, originalSnippet);
      fixedSnippet = fixResult.fixedCode;
      explanation = fixResult.explanation;
      estimatedDebtReduction = fixResult.estimatedDebtReduction;

      // Construct fixed file contents by swapping the snippet
      const lines = originalFileContent.split('\n');
      const before = lines.slice(0, lStart - 1);
      const after = lines.slice(lEnd);
      fixedFileContent = [...before, fixedSnippet, ...after].join('\n');
    }

    // 6. Handle Preview Mode
    if (preview) {
      return NextResponse.json({
        originalSnippet,
        fixedSnippet,
        explanation,
        estimatedDebtReduction,
        originalFileContent,
        fixedFileContent,
      });
    }

    // 7. Handle PR Creation Mode
    const timestamp = Date.now();
    const cleanIssueType = issueType.replace(/_/g, '-');
    const newBranchName = `fix/${cleanIssueType}-${timestamp}`;
    const prTitle = `DebtRadar AutoFix: Add ${cleanIssueType.replace(/-/g, ' ')}`;
    const commitMessage = `refactor: fix technical debt node (${cleanIssueType})`;
    
    const prBody = `## DebtRadar Automated Technical Debt Fix

This Pull Request was generated automatically by **DebtRadar** to address technical debt.

### Detected Issue
* **Type**: \`${issueType}\`
* **File**: \`${filePath}\`
* **Score Improvement**: Reduces Technical Debt score (Estimated Reduction: **-${estimatedDebtReduction}** pts)

### Rationale & Changes
${explanation}

---
*Created automatically by [DebtRadar](https://github.com/syedw/Lume-main)*`;

    if (isDummyToken) {
      return NextResponse.json(
        { error: 'Invalid GitHub token configured. Please set a valid token with repo write permissions before creating a PR.' },
        { status: 401 }
      );
    }

    try {
      // Create new branch
      console.log(`[API Create-PR] Creating branch: ${newBranchName}`);
      await createBranch({
        owner: repoOwner,
        repo: repoName,
        branchName: newBranchName,
        baseBranch: defaultBranch,
        token,
      });

      // Commit file changes
      console.log(`[API Create-PR] Committing changes to ${filePath}`);
      await updateFile({
        owner: repoOwner,
        repo: repoName,
        filePath,
        fileContent: fixedFileContent,
        sha: fileSha,
        branchName: newBranchName,
        commitMessage,
        token,
      });

      // Open Pull Request
      console.log(`[API Create-PR] Creating pull request`);
      const prResult = await createPullRequest({
        owner: repoOwner,
        repo: repoName,
        title: prTitle,
        body: prBody,
        headBranch: newBranchName,
        baseBranch: defaultBranch,
        token,
      });

      return NextResponse.json({
        success: true,
        prUrl: prResult.htmlUrl,
        prNumber: prResult.number,
        estimatedDebtReduction,
        message: 'Pull request successfully generated!',
      });
    } catch (prErr: any) {
      console.error('[API Create-PR] GitHub PR workflow failed:', prErr);
      
      const isNotFound = prErr.status === 404 || prErr.message?.includes('Not Found');
      if (isNotFound) {
        return NextResponse.json(
          { error: `Write permission denied for ${repoOwner}/${repoName}. You do not have permissions to push branches directly to this repository. To open a real Pull Request, please analyze a repository you own or have write permissions to.` },
          { status: 403 }
        );
      }

      const isUnauthorized = prErr.status === 401 || prErr.status === 403 || prErr.message?.includes('Bad credentials') || prErr.message?.includes('401') || prErr.message?.includes('403');
      if (isUnauthorized) {
        return NextResponse.json(
          { error: 'GitHub authentication failed or token lacks write access. Use a valid token with repo scope and write permissions.' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `GitHub PR workflow failed: ${prErr.message || String(prErr)}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[API Create-PR] Route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
