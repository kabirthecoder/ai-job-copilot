import { Octokit } from '@octokit/rest';
import { embed } from '../llm.js';
import { fetchRepoFiles, fetchCommits, fetchPRs } from './github.js';
import { saveIndex, loadIndex } from '../store/vector-store.js';
import type { RepoConfig, RepoIndex } from '../types.js';

const EMBED_BATCH = 5; // concurrent embedding calls

export async function indexRepo(
  config: RepoConfig,
  opts: { force?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<RepoIndex> {
  const repoId = `${config.owner}/${config.repo}`;
  const { onProgress, force } = opts;

  if (!force) {
    const existing = loadIndex(repoId);
    if (existing) {
      onProgress?.(`Using cached index from ${existing.indexedAt} (pass --force to re-index)`);
      return existing;
    }
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const validToken = token && !token.startsWith('your_') ? token : undefined;
  const octokit = new Octokit(validToken ? { auth: validToken } : {});

  // Resolve default branch if not specified
  if (!config.branch || config.branch === 'auto') {
    const { data: repoData } = await octokit.repos.get({ owner: config.owner, repo: config.repo });
    config.branch = repoData.default_branch;
    onProgress?.(`Default branch: ${config.branch}`);
  }

  onProgress?.('Fetching repository files...');
  const { chunks, fileTree } = await fetchRepoFiles(octokit, config, onProgress);

  onProgress?.('Fetching git history...');
  const commits = await fetchCommits(octokit, config, 200);

  onProgress?.('Fetching merged PRs...');
  const prs = await fetchPRs(octokit, config, 50);

  onProgress?.(`Embedding ${chunks.length} code chunks...`);

  // Embed in batches
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    await Promise.all(
      batch.map(async chunk => {
        try {
          chunk.embedding = await embed(`${chunk.filePath}\n${chunk.content}`);
        } catch {
          chunk.embedding = [];
        }
      }),
    );
    if (i % 50 === 0) onProgress?.(`Embedded ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length} chunks`);
  }

  const index: RepoIndex = {
    repoId,
    indexedAt: new Date().toISOString(),
    chunks,
    commits,
    prs,
    fileTree,
  };

  onProgress?.('Saving index...');
  saveIndex(index);
  onProgress?.(`Index saved — ${chunks.length} chunks, ${commits.length} commits, ${prs.length} PRs`);

  return index;
}
