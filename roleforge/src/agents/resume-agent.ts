import { invokeRoleForgeAgent } from "../llm.js";
import { buildResumeAgentPrompt } from "../prompts.js";
import type { AgentContext, AgentResult, ResumeAgentOutput } from "../types.js";

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function isNoiseLine(line: string) {
  const normalized = line.trim();

  if (!normalized) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(normalized)) return true;
  if (/@|linkedin|github|portfolio|phone|email id|mobile|contact/i.test(normalized)) return true;
  if (normalized.length < 18) return true;

  return false;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "hintText" in item && typeof item.hintText === "string") {
        return item.hintText;
      }
      return "";
    })
    .filter(Boolean);
}

export async function runResumeAgent(context: AgentContext): Promise<AgentResult<ResumeAgentOutput>> {
  const lines = context.candidate.resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const evidenceCandidates = lines.filter((line) => !isNoiseLine(line));

  const identityHints = lines.slice(0, 4);
  const skills = unique(
    ["python", "sql", "react", "next.js", "machine learning", "llm", "docker"].filter((skill) =>
      context.candidate.resumeText.toLowerCase().includes(skill)
    )
  );

  const fallbackOutput: ResumeAgentOutput = {
    candidateHeadline: evidenceCandidates[0] ?? lines[0] ?? "Builder with applied AI experience",
    identityHints,
    skills,
    evidenceLines: evidenceCandidates.slice(0, 6),
    likelyProjects: evidenceCandidates
      .filter((line) => /(built|developed|project|created|designed|implemented|launched)/i.test(line))
      .slice(0, 4)
  };
  const prompt = buildResumeAgentPrompt(context);
  const response = await invokeRoleForgeAgent<ResumeAgentOutput>(
    "resume-agent",
    prompt.system,
    prompt.user
  );
  const normalizedOutput = response.output
    ? {
        candidateHeadline:
          typeof response.output.candidateHeadline === "string"
            ? response.output.candidateHeadline
            : fallbackOutput.candidateHeadline,
        identityHints: normalizeStringArray(response.output.identityHints),
        skills: normalizeStringArray(response.output.skills),
        evidenceLines: normalizeStringArray(response.output.evidenceLines).filter((line) => !isNoiseLine(line)),
        likelyProjects: normalizeStringArray(response.output.likelyProjects)
      }
    : null;

  return {
    agent: "resume-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !normalizedOutput,
    output: normalizedOutput ?? fallbackOutput,
    notes: normalizedOutput
      ? ["Resume Agent used its own model call to extract identity, skills, and evidence."]
      : ["Resume Agent fell back to deterministic extraction because the model response was unavailable."]
  };
}
