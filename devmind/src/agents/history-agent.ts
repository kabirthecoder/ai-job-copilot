import { chat } from '../llm.js';
import type { AgentContext, AgentResult } from '../types.js';

export async function historyAgent(ctx: AgentContext): Promise<AgentResult> {
  const { commits, prs } = ctx.index;

  // Keyword-match commits and PRs to the question
  const keywords = ctx.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const relevantCommits = commits
    .filter(c => keywords.some(k => c.message.toLowerCase().includes(k)))
    .slice(0, 20)
    .map(c => `[${c.date.slice(0, 10)}] ${c.author}: ${c.message.slice(0, 200)}`);

  const relevantPRs = prs
    .filter(pr => keywords.some(k =>
      pr.title.toLowerCase().includes(k) || pr.body.toLowerCase().includes(k),
    ))
    .slice(0, 10)
    .map(pr => `PR #${pr.number} (${pr.mergedAt?.slice(0, 10)}): ${pr.title}\n${pr.body.slice(0, 400)}`);

  const context = [
    relevantCommits.length ? `## Relevant commits\n${relevantCommits.join('\n')}` : '',
    relevantPRs.length ? `## Relevant PRs\n${relevantPRs.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n');

  if (!context) {
    return {
      answer: 'No relevant commits or PRs found for this question.',
      sources: [],
      confidence: 'low',
    };
  }

  const answer = await chat([
    {
      role: 'system',
      content: `You are DevMind. Use git history and PR context to explain WHY decisions were made in the ${ctx.repo.owner}/${ctx.repo.repo} repo.
Focus on intent and reasoning, not just what changed.`,
    },
    {
      role: 'user',
      content: `Question: ${ctx.question}\n\nGit history context:\n${context}`,
    },
  ]);

  const sources = relevantPRs.slice(0, 3).map(pr => ({
    file: `PR #${pr.match(/PR #(\d+)/)?.[1]}`,
    reason: 'PR title/body matches question keywords',
  }));

  return { answer, sources, confidence: relevantPRs.length > 0 ? 'high' : 'medium' };
}
