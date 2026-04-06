import { invokeRoleForgeAgent } from "../llm";
import { buildResumeAgentPrompt } from "../prompts";
import type { AgentContext, AgentResult, ResumeAgentOutput } from "../types";

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

export async function runResumeAgent(context: AgentContext): Promise<AgentResult<ResumeAgentOutput>> {
  const lines = context.candidate.resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const identityHints = lines.slice(0, 4);
  const skills = unique(
    ["python", "sql", "react", "next.js", "machine learning", "llm", "docker"].filter((skill) =>
      context.candidate.resumeText.toLowerCase().includes(skill)
    )
  );

  const fallbackOutput: ResumeAgentOutput = {
    identityHints,
    skills,
    evidenceLines: lines.slice(0, 6)
  };
  const prompt = buildResumeAgentPrompt(context);
  const response = await invokeRoleForgeAgent<ResumeAgentOutput>(
    "resume-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "resume-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: response.output ?? fallbackOutput,
    notes: response.output
      ? ["Resume Agent used its own model call to extract identity, skills, and evidence."]
      : ["Resume Agent fell back to deterministic extraction because the model response was unavailable."]
  };
}
