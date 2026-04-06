import { invokeRoleForgeAgent } from "../llm";
import { buildReviewAgentPrompt } from "../prompts";
import type {
  AgentResult,
  CoverLetterAgentOutput,
  ReviewAgentOutput
} from "../types";

export async function runReviewAgent(
  coverLetter: CoverLetterAgentOutput
): Promise<AgentResult<ReviewAgentOutput>> {
  const issues: string[] = [];

  if (coverLetter.coverLetter.length < 500) {
    issues.push("Cover letter is still too short for a realistic application.");
  }

  if (/I am writing to express my interest/i.test(coverLetter.coverLetter)) {
    issues.push("Opening still sounds generic and should be humanized further.");
  }
  const fallbackOutput: ReviewAgentOutput = {
    approved: issues.length === 0,
    issues
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
    output: response.output ?? fallbackOutput,
    notes: response.output
      ? ["Review Agent used its own model call to critique the generated cover letter."]
      : ["Review Agent fell back to deterministic checks because the model response was unavailable."]
  };
}
