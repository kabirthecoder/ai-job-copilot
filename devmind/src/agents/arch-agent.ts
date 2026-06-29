import { chat } from '../llm.js';
import type { AgentContext, AgentResult } from '../types.js';

export async function archAgent(ctx: AgentContext): Promise<AgentResult> {
  const { fileTree, chunks } = ctx.index;

  // Find config/entry files that reveal architecture
  const importantFiles = fileTree.filter(f =>
    /package\.json|go\.mod|requirements\.txt|Cargo\.toml|pom\.xml|README|docker|Makefile|\.github|main\.|index\.|app\.|server\.|cmd\//i.test(f),
  ).slice(0, 50);

  // Grab content of key files from chunks
  const keyChunks = chunks
    .filter(c => importantFiles.some(f => c.filePath === f))
    .slice(0, 20)
    .map(c => `// ${c.filePath}\n${c.content.slice(0, 500)}`);

  const treeContext = importantFiles.join('\n');
  const codeContext = keyChunks.join('\n\n---\n\n');

  const answer = await chat([
    {
      role: 'system',
      content: `You are DevMind. Analyze the file structure and key files of ${ctx.repo.owner}/${ctx.repo.repo} to answer architecture questions.
Explain the system design, component relationships, data flow, and tech stack decisions.`,
    },
    {
      role: 'user',
      content: `Question: ${ctx.question}\n\nFile tree (key files):\n${treeContext}\n\nKey file contents:\n${codeContext}`,
    },
  ]);

  return {
    answer,
    sources: importantFiles.slice(0, 5).map(f => ({ file: f, reason: 'Key architecture file' })),
    confidence: 'high',
  };
}
