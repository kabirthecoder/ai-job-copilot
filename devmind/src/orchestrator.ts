import { chat } from './llm.js';
import { codeAgent } from './agents/code-agent.js';
import { historyAgent } from './agents/history-agent.js';
import { archAgent } from './agents/arch-agent.js';
import type { AgentContext, AgentResult } from './types.js';

type AgentType = 'code' | 'history' | 'architecture' | 'hybrid';

async function routeQuestion(question: string): Promise<AgentType> {
  const raw = await chat([
    {
      role: 'system',
      content: `Classify the developer question into exactly one category. Reply with ONLY the word.
- "code": about specific functions, files, variables, how something is implemented
- "history": about WHY something was built, past decisions, what changed, who did what
- "architecture": about system design, data flow, tech stack, overall structure, component relationships
- "hybrid": spans multiple categories`,
    },
    { role: 'user', content: question },
  ]);

  const t = raw.trim().toLowerCase();
  if (['code', 'history', 'architecture', 'hybrid'].includes(t)) return t as AgentType;
  return 'hybrid';
}

export async function ask(ctx: AgentContext): Promise<AgentResult> {
  const agentType = await routeQuestion(ctx.question);

  if (agentType === 'history') return historyAgent(ctx);
  if (agentType === 'architecture') return archAgent(ctx);
  if (agentType === 'code') return codeAgent(ctx);

  // hybrid: run code + history in parallel, synthesize
  const [codeResult, histResult] = await Promise.all([
    codeAgent(ctx),
    historyAgent(ctx),
  ]);

  const synthesis = await chat([
    {
      role: 'system',
      content: `You are DevMind. Synthesize two perspectives into one clear answer about ${ctx.repo.owner}/${ctx.repo.repo}.`,
    },
    {
      role: 'user',
      content: `Question: ${ctx.question}

Code perspective:
${codeResult.answer}

History perspective:
${histResult.answer}

Provide a unified answer that draws from both.`,
    },
  ]);

  return {
    answer: synthesis,
    sources: [...codeResult.sources, ...histResult.sources].slice(0, 6),
    confidence: 'high',
  };
}
