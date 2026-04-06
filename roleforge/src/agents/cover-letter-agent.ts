import { invokeRoleForgeAgent } from "../llm";
import { buildCoverLetterAgentPrompt } from "../prompts";
import type {
  AgentContext,
  AgentResult,
  CoverLetterAgentOutput,
  GapAgentOutput,
  JobAgentOutput,
  ResearchAgentOutput,
  ResumeAgentOutput
} from "../types";

export async function runCoverLetterAgent(
  context: AgentContext,
  resume: ResumeAgentOutput,
  job: JobAgentOutput,
  research: ResearchAgentOutput,
  gap: GapAgentOutput
): Promise<AgentResult<CoverLetterAgentOutput>> {
  const role = context.target.targetRole ?? "the role";
  const company = context.target.companyName ?? "the company";
  const firstStrength = resume.skills[0] ?? "hands-on technical work";
  const firstGap = gap.focusAreas[0] ?? "the most important role themes";

  const prompt = buildCoverLetterAgentPrompt(context, resume, job, research, gap);
  const response = await invokeRoleForgeAgent<CoverLetterAgentOutput>(
    "cover-letter-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "cover-letter-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: {
      coverLetter:
        response.output?.coverLetter ??
        [
        `Dear Hiring Team at ${company},`,
        `I am writing to express my interest in the ${role} opportunity. What stands out most to me is the chance to contribute to meaningful work while deepening my strength in ${firstGap}.`,
        `My background includes ${firstStrength} and related project work, and I am especially motivated by roles that combine execution, learning, and practical business impact.${research.companySummary ? ` ${research.companySummary}` : ""}`,
        `I would welcome the opportunity to contribute with curiosity, ownership, and a strong builder mindset.`,
        "Sincerely,"
      ].join("\n\n")
    },
    notes: response.output
      ? ["Cover Letter Agent used its own model call to draft a JD-aware application letter."]
      : ["Cover Letter Agent fell back because the model response was unavailable."]
  };
}
