import type { AgentContext, AgentResult, ResumeAgentOutput } from "../types.js";

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function isNoiseLine(line: string) {
  const normalized = line.trim();

  if (!normalized) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(normalized)) return true;
  if (/@|linkedin|github|phone|email id|mobile|contact/i.test(normalized)) return true;
  if (normalized.length < 18) return true;

  return false;
}

function splitEvidenceSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24 && !isNoiseLine(sentence));
}

function dedupeEvidence(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
  }

  return result;
}

export async function runResumeAgent(context: AgentContext): Promise<AgentResult<ResumeAgentOutput>> {
  const lines = context.candidate.resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const evidenceCandidates = lines.filter((line) => !isNoiseLine(line));
  const sentenceEvidence = splitEvidenceSentences(context.candidate.resumeText);
  const combinedEvidence = dedupeEvidence([
    ...sentenceEvidence,
    ...evidenceCandidates.filter((line) => !sentenceEvidence.some((sentence) => line.includes(sentence)))
  ]);

  const identityHints = lines
    .filter((line) => line.length >= 3 && line.length <= 80)
    .slice(0, 4);
  const output: ResumeAgentOutput = {
    candidateHeadline: combinedEvidence[0] ?? lines[0] ?? "Builder with applied AI experience",
    identityHints,
    skills: unique(context.nlp?.resumeSkills ?? []),
    evidenceLines: combinedEvidence.slice(0, 6),
    likelyProjects: combinedEvidence
      .filter((line) => /(built|developed|project|created|designed|implemented|launched|prototype|workflow|dashboard)/i.test(line))
      .slice(0, 4)
  };

  return {
    agent: "resume-agent",
    mode: "deterministic",
    model: "nlp-parser",
    usedFallback: false,
    output,
    notes: ["Resume Agent used deterministic parsing and NLP signals to extract identity hints, skills, and evidence."]
  };
}
