import { invokeRoleForgeAgent } from "../llm";
import { buildResearchAgentPrompt } from "../prompts";
import type { AgentContext, AgentResult, ResearchAgentOutput } from "../types";

export async function runResearchAgent(
  context: AgentContext
): Promise<AgentResult<ResearchAgentOutput>> {
  const fallbackOutput: ResearchAgentOutput = {
    status: context.target.companyWebsite ? "researched" : "failed",
    companySummary: context.target.companyWebsite
      ? `Research placeholder for ${context.target.companyName ?? "the target company"}.`
      : "No direct company site was provided, so deeper company research was skipped.",
    latestSignals: [],
    sources: context.target.companyWebsite ? [context.target.companyWebsite] : []
  };
  const prompt = buildResearchAgentPrompt(context);
  const response = await invokeRoleForgeAgent<ResearchAgentOutput>(
    "research-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "research-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: response.output ?? fallbackOutput,
    notes: response.output
      ? ["Research Agent used its own model call to summarize company context conservatively."]
      : ["Research Agent fell back because live research summarization was unavailable."]
  };
}
