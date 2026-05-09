import { invokeRoleForgeAgent } from "../llm.js";
import { buildJobAgentPrompt } from "../prompts.js";
import type { AgentContext, AgentResult, JobAgentOutput } from "../types.js";

function detectLanguageRequirements(text: string) {
  const hits: string[] = [];
  if (/\b(deutsch|german)\b/i.test(text)) hits.push("German");
  if (/\b(englisch|english)\b/i.test(text)) hits.push("English");
  return [...new Set(hits)];
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export async function runJobAgent(context: AgentContext): Promise<AgentResult<JobAgentOutput>> {
  const jd = context.target.jobDescription.toLowerCase();
  const fallbackOutput: JobAgentOutput = {
    seniority: context.nlp?.seniorityHint || (/\b(senior|lead|5\+ years)\b/i.test(jd) ? "Senior" : "Unspecified"),
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
    languageRequirements: context.nlp?.detectedLanguages.length
      ? context.nlp.detectedLanguages
      : detectLanguageRequirements(context.target.jobDescription),
    businessNeeds: context.nlp?.roleThemes.slice(0, 4) ?? [],
    successSignals: ["production ownership", "cross-functional impact", "measurable outcomes"].filter(
      (signal) => jd.includes(signal.split(" ")[0])
    )
  };
  const prompt = buildJobAgentPrompt(context);
  const response = await invokeRoleForgeAgent<JobAgentOutput>(
    "job-agent",
    prompt.system,
    prompt.user
  );
  const normalizedOutput = response.output
    ? {
        seniority:
          typeof response.output.seniority === "string" ? response.output.seniority : fallbackOutput.seniority,
        roleFamily:
          typeof response.output.roleFamily === "string" ? response.output.roleFamily : fallbackOutput.roleFamily,
        mustHaves: normalizeStringArray(response.output.mustHaves),
        niceToHaves: normalizeStringArray(response.output.niceToHaves),
        languageRequirements: normalizeStringArray(response.output.languageRequirements),
        businessNeeds: normalizeStringArray(response.output.businessNeeds),
        successSignals: normalizeStringArray(response.output.successSignals)
      }
    : null;

  return {
    agent: "job-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !normalizedOutput,
    output: normalizedOutput ?? fallbackOutput,
    notes: normalizedOutput
      ? ["Job Agent used its own model call to parse seniority, must-haves, and language requirements."]
      : ["Job Agent fell back to deterministic parsing because the model response was unavailable."]
  };
}
