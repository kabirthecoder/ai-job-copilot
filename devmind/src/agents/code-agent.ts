import { chat, embed } from '../llm.js';
import { searchChunks } from '../store/vector-store.js';
import type { AgentContext, AgentResult } from '../types.js';

export async function codeAgent(ctx: AgentContext): Promise<AgentResult> {
  const qEmbed = await embed(ctx.question);
  const relevant = searchChunks(ctx.index.chunks, qEmbed, 8);

  const context = relevant
    .map(c => `// ${c.filePath} (lines ${c.startLine}-${c.endLine})\n${c.content}`)
    .join('\n\n---\n\n');

  const answer = await chat([
    {
      role: 'system',
      content: `You are DevMind, an expert engineer who knows the ${ctx.repo.owner}/${ctx.repo.repo} codebase deeply.
Answer questions using ONLY the provided code context. Be specific — cite file names and line numbers.
If you don't know, say so rather than guessing.`,
    },
    {
      role: 'user',
      content: `Question: ${ctx.question}\n\nCode context:\n${context}`,
    },
  ]);

  const sources = relevant.slice(0, 4).map(c => ({
    file: c.filePath,
    lines: `${c.startLine}-${c.endLine}`,
    reason: 'Semantically relevant to question',
  }));

  return { answer, sources, confidence: relevant.length >= 4 ? 'high' : 'medium' };
}
