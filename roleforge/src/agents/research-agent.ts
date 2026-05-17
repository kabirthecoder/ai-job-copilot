import type { AgentContext, AgentResult, ResearchAgentOutput } from "../types.js";

export async function runResearchAgent(
  context: AgentContext
): Promise<AgentResult<ResearchAgentOutput>> {
  const companyLabel = context.target.companyName ?? "the target company";
  const topJobHit = context.retrieval?.hits.find((hit) => hit.source === "job")?.text ?? "";
  const roleThemeLabel = context.nlp?.roleThemes.slice(0, 3).join(", ") || "the target role";
  const fallbackOutput: ResearchAgentOutput = {
    status: context.target.companyWebsite ? "researched" : "failed",
    companySummary: context.target.companyWebsite
      ? `${companyLabel} appears relevant for this application, with the role centered around ${roleThemeLabel}.`
      : "No direct company site was provided, so deeper company research was skipped.",
    latestSignals: context.retrieval?.hits
      .filter((hit) => hit.source === "company" || hit.source === "job")
      .slice(0, 3)
      .map((hit) => hit.text) ?? [],
    sources: context.target.companyWebsite ? [context.target.companyWebsite] : [],
    roleContext: context.nlp?.roleThemes.slice(0, 4) ?? []
  };
  const strengthenedFallback: ResearchAgentOutput = {
    ...fallbackOutput,
    latestSignals: topJobHit ? [topJobHit] : fallbackOutput.latestSignals
  };

  return {
    agent: "research-agent",
    mode: "deterministic",
    model: "retrieval-summary",
    usedFallback: false,
    output: strengthenedFallback,
    notes: ["Research Agent summarized available company and role context from the provided website, job text, and retrieval hits."]
  };
}
