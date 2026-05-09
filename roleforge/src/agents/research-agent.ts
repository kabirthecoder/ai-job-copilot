import { invokeRoleForgeAgent } from "../llm.js";
import { buildResearchAgentPrompt } from "../prompts.js";
import type { AgentContext, AgentResult, ResearchAgentOutput } from "../types.js";

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export async function runResearchAgent(
  context: AgentContext
): Promise<AgentResult<ResearchAgentOutput>> {
  const fallbackOutput: ResearchAgentOutput = {
    status: context.target.companyWebsite ? "researched" : "failed",
    companySummary: context.target.companyWebsite
      ? `Research placeholder for ${context.target.companyName ?? "the target company"}, aligned with themes like ${context.nlp?.roleThemes.slice(0, 3).join(", ") || "the target role"}.`
      : "No direct company site was provided, so deeper company research was skipped.",
    latestSignals: context.retrieval?.hits
      .filter((hit) => hit.source === "company" || hit.source === "job")
      .slice(0, 3)
      .map((hit) => hit.text) ?? [],
    sources: context.target.companyWebsite ? [context.target.companyWebsite] : [],
    roleContext: context.nlp?.roleThemes.slice(0, 4) ?? []
  };
  const prompt = buildResearchAgentPrompt(context);
  const response = await invokeRoleForgeAgent<ResearchAgentOutput>(
    "research-agent",
    prompt.system,
    prompt.user
  );
  const normalizedOutput = response.output
    ? {
        status:
          response.output.status === "not_requested" ||
          response.output.status === "researched" ||
          response.output.status === "failed"
            ? response.output.status
            : fallbackOutput.status,
        companySummary:
          typeof response.output.companySummary === "string"
            ? response.output.companySummary
            : fallbackOutput.companySummary,
        latestSignals: normalizeStringArray(response.output.latestSignals),
        sources: normalizeStringArray(response.output.sources),
        roleContext: normalizeStringArray(response.output.roleContext)
      }
    : null;

  return {
    agent: "research-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !normalizedOutput,
    output: normalizedOutput ?? fallbackOutput,
    notes: normalizedOutput
      ? ["Research Agent used its own model call to summarize company context conservatively."]
      : ["Research Agent fell back because live research summarization was unavailable."]
  };
}
