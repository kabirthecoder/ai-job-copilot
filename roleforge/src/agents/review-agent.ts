import { invokeRoleForgeAgent } from "../llm.js";
import { buildReviewAgentPrompt } from "../prompts.js";
import type {
  AgentResult,
  CoverLetterHumanizerOutput,
  ReviewAgentOutput
} from "../types.js";

export async function runReviewAgent(
  coverLetter: CoverLetterHumanizerOutput
): Promise<AgentResult<ReviewAgentOutput>> {
  const issues: string[] = [];

  if (coverLetter.coverLetter.length < 500) {
    issues.push("Cover letter is still too short for a realistic application.");
  }

  if (/I am writing to express my interest|I am writing to express my keen interest|esteemed organization/i.test(coverLetter.coverLetter)) {
    issues.push("Opening still sounds generic and should be humanized further.");
  }
  const fallbackOutput: ReviewAgentOutput = {
    approved: issues.length === 0,
    issues,
    finalRecommendation:
      issues.length === 0
        ? "Ship this cover letter and then tailor one or two examples before applying."
        : "Revise the draft before applying, especially the opening and role-specific evidence."
  };
  const prompt = buildReviewAgentPrompt(coverLetter.coverLetter);
  const response = await invokeRoleForgeAgent<ReviewAgentOutput>(
    "review-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "review-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output:
      response.output
        ? {
            approved:
              typeof response.output.approved === "boolean"
                ? response.output.approved
                : fallbackOutput.approved,
            issues: Array.isArray(response.output.issues)
              ? response.output.issues.filter((item) => typeof item === "string")
              : fallbackOutput.issues,
            revisedCoverLetter:
              typeof response.output.revisedCoverLetter === "string"
                ? response.output.revisedCoverLetter
                : undefined,
            finalRecommendation:
              typeof response.output.finalRecommendation === "string"
                ? response.output.finalRecommendation
                : fallbackOutput.finalRecommendation
          }
        : fallbackOutput,
    notes: response.output
      ? ["Review Agent used its own model call to critique the generated cover letter."]
      : ["Review Agent fell back to deterministic checks because the model response was unavailable."]
  };
}
