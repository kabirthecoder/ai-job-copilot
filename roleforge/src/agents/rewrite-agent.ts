import { invokeRoleForgeAgent } from "../llm.js";
import { buildRewriteAgentPrompt } from "../prompts.js";
import type {
  AgentContext,
  AgentResult,
  GapAgentOutput,
  RewriteAgentOutput,
  ResumeAgentOutput
} from "../types.js";

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function normalizeProjectedScore(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value >= 0 && value <= 1) {
    return Math.round(value * 100);
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanEvidenceLine(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^[•\-–]\s*/, "")
    .trim();
}

function sentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function runRewriteAgent(
  context: AgentContext,
  resume: ResumeAgentOutput,
  gap: GapAgentOutput
): Promise<AgentResult<RewriteAgentOutput>> {
  const role = context.target.targetRole ?? "target role";
  const bullets = resume.evidenceLines.slice(0, 3).map((line, index) => {
    const cleaned = cleanEvidenceLine(line);
    if (index === 0) {
      return `${sentenceCase(cleaned)} while building evidence that maps well to ${role.toLowerCase()} responsibilities.`;
    }

    return `${sentenceCase(cleaned)} with clearer emphasis on ${gap.focusAreas[0] ?? "higher-impact role requirements"} and measurable delivery.`;
  });
  const prompt = buildRewriteAgentPrompt(context, resume, gap);
  const response = await invokeRoleForgeAgent<RewriteAgentOutput>(
    "rewrite-agent",
    prompt.system,
    prompt.user
  );
  const fallbackSummary = `Hands-on builder targeting ${role}, with clear strengths in ${resume.skills.slice(0, 3).join(", ") || "applied execution"} and a sharper story around ${gap.focusAreas.join(", ") || "high-impact delivery"}.`;
  const projectedAtsScore = Math.max(gap.atsScore + Math.max(12, gap.highPriorityFixes.length * 6), gap.targetAtsScore);
  const fallbackArtifact = [
    `# Tailored Resume for ${role}`,
    "",
    "## Professional Summary",
    fallbackSummary,
    "",
    `## ATS Target`,
    `Current ATS score: ${gap.atsScore}/100`,
    `Projected ATS after these changes: ${Math.min(projectedAtsScore, 97)}/100`,
    "",
    "## Tailored Experience Bullets",
    ...bullets.map((bullet) => `- ${bullet}`),
    "",
    "## Priority Fixes To Reach 90%+",
    ...gap.highPriorityFixes.map((fix) => `- ${fix}`)
  ].join("\n");
  const normalizedBullets = response.output ? normalizeStringArray(response.output.rewrittenBullets) : [];
  const outputLooksWeak =
    normalizedBullets.length === 0 ||
    normalizedBullets.some((bullet) => bullet.length < 32 || /built and delivered built/i.test(bullet));

  return {
    agent: "rewrite-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output || outputLooksWeak,
    output:
      response.output && !outputLooksWeak
        ? {
            rewrittenBullets: normalizedBullets,
            revisedSummary:
              typeof response.output.revisedSummary === "string"
                ? response.output.revisedSummary
                : fallbackSummary,
            projectedAtsScore:
              normalizeProjectedScore(
                response.output.projectedAtsScore,
                Math.min(projectedAtsScore, 97)
              ),
            revisedResumeArtifact:
              typeof response.output.revisedResumeArtifact === "string"
                ? response.output.revisedResumeArtifact
                : fallbackArtifact
          }
        : {
            rewrittenBullets: bullets,
            revisedSummary: fallbackSummary,
            projectedAtsScore: Math.min(projectedAtsScore, 97),
            revisedResumeArtifact: fallbackArtifact
          },
    notes: response.output && !outputLooksWeak
      ? ["Resume Rewrite Agent used its own model call to tailor the candidate's bullets to the role."]
      : ["Resume Rewrite Agent fell back to deterministic rewriting because the model response was unavailable or too weak."]
  };
}
