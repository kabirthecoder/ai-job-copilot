import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CodeChunk, RepoIndex } from '../types.js';

function storePath(): string {
  const base = process.env.DEVMIND_STORE_PATH?.replace('~', os.homedir()) ?? path.join(os.homedir(), '.devmind', 'store');
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function indexFile(repoId: string): string {
  const safe = repoId.replace(/[/\\]/g, '__');
  return path.join(storePath(), `${safe}.json`);
}

export function saveIndex(index: RepoIndex): void {
  fs.writeFileSync(indexFile(index.repoId), JSON.stringify(index), 'utf-8');
}

export function loadIndex(repoId: string): RepoIndex | null {
  const file = indexFile(repoId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as RepoIndex;
}

export function listIndexed(): string[] {
  const dir = storePath();
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', '').replace(/__/g, '/'));
}

export function deleteIndex(repoId: string): void {
  const file = indexFile(repoId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

export function searchChunks(
  chunks: CodeChunk[],
  queryEmbedding: number[],
  topK = 8,
): CodeChunk[] {
  const scored = chunks
    .filter(c => c.embedding && c.embedding.length > 0)
    .map(c => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding!) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(s => s.chunk);
}
