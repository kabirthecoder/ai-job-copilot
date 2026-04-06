import { invokeRoleForgeAgent } from "../llm";
import { buildJobAgentPrompt } from "../prompts";
import type { AgentContext, AgentResult, JobAgentOutput } from "../types";

function detectLanguageRequirements(text: string) {
  const hits: string[] = [];
  if (/\b(deutsch|german)\b/i.test(text)) hits.push("German");
  if (/\b(englisch|english)\b/i.test(text)) hits.push("English");
  return [...new Set(hits)];
}

export async function runJobAgent(context: AgentContext): Promise<AgentResult<JobAgentOutput>> {
  const jd = context.target.jobDescription.toLowerCase();
  const fallbackOutput: JobAgentOutput = {
    seniority: /\b(senior|lead|5\+ years)\b/i.test(jd) ? "Senior" : "Unspecified",
    roleFamily: /\b(data scientist|applied scientist)\b/i.test(jd)
      ? "Data / Applied Science"
      : /\b(ai engineer|ml engineer|machine learning engineer)\b/i.test(jd)
        ? "AI / ML Engineering"
        : "General",
    mustHaves: ["python", "sql", "machine learning", "experimentation"].filter((skill) =>
      jd.includes(skill)
    ),
    niceToHaves: ["forecasting", "optimization", "bandits", "reinforcement learning"].filter(
      (skill) => jd.includes(skill)
    ),
    languageRequirements: detectLanguageRequirements(context.target.jobDescription)
  };
  const prompt = buildJobAgentPrompt(context);
  const response = await invokeRoleForgeAgent<JobAgentOutput>(
    "job-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "job-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: response.output ?? fallbackOutput,
    notes: response.output
      ? ["Job Agent used its own model call to parse seniority, must-haves, and language requirements."]
      : ["Job Agent fell back to deterministic parsing because the model response was unavailable."]
  };
}
