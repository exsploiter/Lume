const { Octokit } = require('octokit');

const JS_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
]);

const MAX_FILES = 150;
const MAX_FILE_SIZE = 100_000;

function createOctokit() {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit(token ? { auth: token } : {});
}

async function fetchRepositoryFiles(owner, repo) {
  console.log("Creating Octokit...");
  const octokit = createOctokit();
  console.log(`Fetching git tree for ${owner}/${repo} using tree_sha: 'HEAD'...`);
  try {
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: '1',
    });
    console.log("Successfully fetched tree. Total items:", treeData.tree ? treeData.tree.length : 0);
  } catch (err) {
    console.error("Failed to fetch tree with HEAD:", err);
  }
}

async function run() {
  await fetchRepositoryFiles('Aman-jha12', 'jee_mockup');
}

run();
