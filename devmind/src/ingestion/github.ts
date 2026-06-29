import { Octokit } from '@octokit/rest';
import type { RepoConfig, CodeChunk, GitCommit, PRSummary } from '../types.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.md', '.mdx', '.txt', '.yaml', '.yml', '.json',
  '.sh', '.env.example', '.dockerfile',
]);

const IGNORED_PATHS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', '.venv', 'vendor', 'coverage',
]);

function getExt(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

function isSupported(path: string): boolean {
  if (IGNORED_PATHS.has(path.split('/')[0])) return false;
  if (path.split('/').some(p => IGNORED_PATHS.has(p))) return false;
  return SUPPORTED_EXTENSIONS.has(getExt(path));
}

function chunkText(content: string, filePath: string, chunkSize = 80): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + chunkSize, lines.length);
    const text = lines.slice(i, end).join('\n').trim();
    if (text.length > 20) {
      chunks.push({
        id: `${filePath}:${i + 1}-${end}`,
        filePath,
        content: text,
        startLine: i + 1,
        endLine: end,
        language: getExt(filePath).replace('.', ''),
      });
    }
    i = end;
  }
  return chunks;
}

export async function fetchRepoFiles(
  octokit: Octokit,
  config: RepoConfig,
  onProgress?: (msg: string) => void,
): Promise<{ chunks: CodeChunk[]; fileTree: string[] }> {
  const { owner, repo, branch } = config;

  // Get full file tree via git trees API (recursive, single request)
  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true',
  });

  const files = (tree.tree ?? []).filter(
    f => f.type === 'blob' && f.path && isSupported(f.path),
  );

  onProgress?.(`Found ${files.length} files to index`);

  const fileTree = (tree.tree ?? [])
    .filter(f => f.path)
    .map(f => f.path!)
    .slice(0, 2000);

  const chunks: CodeChunk[] = [];

  // Fetch files in batches to avoid rate limiting
  const BATCH = 10;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async f => {
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: f.path!,
            ref: branch,
          });
          if ('content' in data && data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            chunks.push(...chunkText(content, f.path!));
          }
        } catch {
          // skip files that fail (binary, too large, etc.)
        }
      }),
    );
    if (i % 50 === 0) onProgress?.(`Indexed ${Math.min(i + BATCH, files.length)}/${files.length} files`);
  }

  return { chunks, fileTree };
}

export async function fetchCommits(
  octokit: Octokit,
  config: RepoConfig,
  limit = 200,
): Promise<GitCommit[]> {
  const { data } = await octokit.repos.listCommits({
    owner: config.owner,
    repo: config.repo,
    sha: config.branch,
    per_page: Math.min(limit, 100),
  });

  return data.map(c => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? 'unknown',
    date: c.commit.author?.date ?? '',
    filesChanged: [], // fetch lazily only when needed
  }));
}

export async function fetchPRs(
  octokit: Octokit,
  config: RepoConfig,
  limit = 50,
): Promise<PRSummary[]> {
  const { data } = await octokit.pulls.list({
    owner: config.owner,
    repo: config.repo,
    state: 'closed',
    per_page: Math.min(limit, 50),
    sort: 'updated',
    direction: 'desc',
  });

  return data
    .filter(pr => pr.merged_at)
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      mergedAt: pr.merged_at ?? null,
      filesChanged: [],
    }));
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // handles https://github.com/owner/repo and owner/repo shorthand
  const clean = url.replace(/\.git$/, '').replace(/\/$/, '');
  const match = clean.match(/(?:github\.com[:/])([^/]+)\/([^/]+)$/);
  if (!match) throw new Error(`Cannot parse GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2] };
}
