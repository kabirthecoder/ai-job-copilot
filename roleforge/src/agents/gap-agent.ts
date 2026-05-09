import { invokeRoleForgeAgent } from "../llm.js";
import { buildGapAgentPrompt } from "../prompts.js";
import type {
  AgentResult,
  GapAgentOutput,
  JobAgentOutput,
  ResumeAgentOutput
} from "../types.js";

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function normalizeScore(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value >= 0 && value <= 1) {
    return Math.round(value * 100);
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeEvidenceMap(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const skill = "skill" in item && typeof item.skill === "string" ? item.skill : "";
          const status =
            "status" in item && (item.status === "matched" || item.status === "missing")
              ? item.status
              : "missing";
          const evidence = "evidence" in item && typeof item.evidence === "string" ? item.evidence : "";
          return skill ? { skill, status, evidence } : null;
        })
        .filter(
          (item): item is { skill: string; status: "matched" | "missing"; evidence: string } =>
            Boolean(item)
        )
    : [];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function runGapAgent(
  resume: ResumeAgentOutput,
  job: JobAgentOutput
): Promise<AgentResult<GapAgentOutput>> {
  const matchedMustHaves = job.mustHaves.filter((skill) => resume.skills.includes(skill));
  const missingMustHaves = job.mustHaves.filter((skill) => !resume.skills.includes(skill));
  const atsScore = job.mustHaves.length
    ? Math.round((matchedMustHaves.length / job.mustHaves.length) * 100)
    : 72;
  const fallbackOutput: GapAgentOutput = {
    strengths: matchedMustHaves,
    gaps: missingMustHaves,
    focusAreas: missingMustHaves.slice(0, 3),
    atsScore,
    targetAtsScore: Math.max(90, atsScore),
    matchedCount: matchedMustHaves.length,
    missingCount: missingMustHaves.length,
    evidenceMap: job.mustHaves.slice(0, 8).map((skill) => ({
      skill,
      status: resume.skills.includes(skill) ? "matched" : "missing",
      evidence: resume.evidenceLines.find((line) => line.toLowerCase().includes(skill)) ?? "No direct evidence found."
    })),
    applicationStrategy: [
      "Lead with matched strengths that map directly to the job's must-have skills.",
      "Acknowledge one high-value gap and show a concrete learning or project plan.",
      "Use resume bullets and cover letter examples that emphasize production impact."
    ],
    highPriorityFixes: missingMustHaves.slice(0, 3).map(
      (skill) => `Add credible evidence for ${skill} in the summary or experience bullets.`
    )
  };
  const prompt = buildGapAgentPrompt(resume, job);
  const response = await invokeRoleForgeAgent<GapAgentOutput>(
    "gap-agent",
    prompt.system,
    prompt.user
  );
  const normalizedOutput = response.output
    ? {
        strengths: normalizeStringArray(response.output.strengths),
        gaps: normalizeStringArray(response.output.gaps),
        focusAreas: normalizeStringArray(response.output.focusAreas),
        atsScore: normalizeScore(response.output.atsScore, fallbackOutput.atsScore),
        targetAtsScore: normalizeScore(response.output.targetAtsScore, fallbackOutput.targetAtsScore),
        matchedCount:
          typeof response.output.matchedCount === "number"
            ? response.output.matchedCount
            : fallbackOutput.matchedCount,
        missingCount:
          typeof response.output.missingCount === "number"
            ? response.output.missingCount
            : fallbackOutput.missingCount,
        evidenceMap: normalizeEvidenceMap(response.output.evidenceMap),
        applicationStrategy: normalizeStringArray(response.output.applicationStrategy),
        highPriorityFixes: normalizeStringArray(response.output.highPriorityFixes)
      }
    : null;

  const hasWeakStructuredOutput =
    normalizedOutput &&
    normalizedOutput.strengths.length === 0 &&
    normalizedOutput.evidenceMap.length === 0;

  const output = hasWeakStructuredOutput || !normalizedOutput
    ? fallbackOutput
    : {
        ...normalizedOutput,
        strengths: normalizedOutput.strengths.length ? normalizedOutput.strengths : fallbackOutput.strengths,
        gaps: normalizedOutput.gaps.length ? normalizedOutput.gaps : fallbackOutput.gaps,
        focusAreas: normalizedOutput.focusAreas.length ? normalizedOutput.focusAreas : fallbackOutput.focusAreas,
        atsScore: normalizedOutput.atsScore === 0 && matchedMustHaves.length > 0
          ? fallbackOutput.atsScore
          : clampScore(normalizedOutput.atsScore),
        targetAtsScore: clampScore(Math.max(normalizedOutput.targetAtsScore, fallbackOutput.targetAtsScore)),
        matchedCount: normalizedOutput.matchedCount || fallbackOutput.matchedCount,
        missingCount:
          typeof normalizedOutput.missingCount === "number"
            ? normalizedOutput.missingCount
            : fallbackOutput.missingCount,
        evidenceMap: normalizedOutput.evidenceMap.length ? normalizedOutput.evidenceMap : fallbackOutput.evidenceMap,
        applicationStrategy:
          normalizedOutput.applicationStrategy.length
            ? normalizedOutput.applicationStrategy
            : fallbackOutput.applicationStrategy,
        highPriorityFixes:
          normalizedOutput.highPriorityFixes.length
            ? normalizedOutput.highPriorityFixes
            : fallbackOutput.highPriorityFixes
      };

  return {
    agent: "gap-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !normalizedOutput || Boolean(hasWeakStructuredOutput),
    output,
    notes: normalizedOutput && !hasWeakStructuredOutput
      ? ["Gap Agent used its own model call to compare profile strengths, gaps, and focus areas."]
      : ["Gap Agent fell back to deterministic comparison because the model response was unavailable or too weak."]
  };
}
