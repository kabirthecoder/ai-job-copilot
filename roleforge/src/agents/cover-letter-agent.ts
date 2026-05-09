import { invokeRoleForgeAgent } from "../llm.js";
import { buildCoverLetterAgentPrompt } from "../prompts.js";
import type {
  AgentContext,
  AgentResult,
  CoverLetterAgentOutput,
  GapAgentOutput,
  JobAgentOutput,
  ResearchAgentOutput,
  ResumeAgentOutput
} from "../types.js";

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function needsFallback(letter: string) {
  return (
    !letter ||
    letter.length < 650 ||
    /I am writing to express my/i.test(letter) ||
    /keen interest/i.test(letter) ||
    /esteemed organization/i.test(letter)
  );
}

function deriveCompanyName(context: AgentContext) {
  if (context.target.companyName?.trim()) {
    return context.target.companyName.trim();
  }

  if (context.target.companyWebsite) {
    try {
      const url = new URL(context.target.companyWebsite);
      const host = url.hostname.replace(/^www\./, "").split(".")[0];
      return host ? host.charAt(0).toUpperCase() + host.slice(1) : "the company";
    } catch {
      return "the company";
    }
  }

  return "the company";
}

export async function runCoverLetterAgent(
  context: AgentContext,
  resume: ResumeAgentOutput,
  job: JobAgentOutput,
  research: ResearchAgentOutput,
  gap: GapAgentOutput
): Promise<AgentResult<CoverLetterAgentOutput>> {
  const role = context.target.targetRole ?? "the role";
  const company = deriveCompanyName(context);
  const firstStrength = gap.strengths[0] ?? resume.skills[0] ?? "hands-on technical work";
  const firstGap = gap.focusAreas[0] ?? "the most important role themes";
  const businessNeed = job.businessNeeds[0] ?? job.mustHaves[0] ?? "high-impact execution";
  const sellingPoints = [
    `Evidence of strength in ${firstStrength}`,
    `Clear growth plan around ${firstGap}`,
    `Alignment with ${businessNeed}`
  ];
  const evidenceOne = resume.evidenceLines[0] ?? resume.candidateHeadline;
  const evidenceTwo = resume.evidenceLines[1] ?? "";
  const roleSignal = research.latestSignals[0] ?? job.businessNeeds[0] ?? businessNeed;
  const fallbackLetter = [
    `Dear Hiring Team at ${company},`,
    "",
    `What draws me to this ${role} opening is how directly it sits at the intersection of ${businessNeed} and practical execution. The role feels close to the work I enjoy most: taking something technical, making it useful, and improving it through iteration instead of leaving it at the prototype stage.`,
    "",
    `In my own work, I already have a strong starting point in ${firstStrength}. ${evidenceOne} ${evidenceTwo ? `${evidenceTwo} ` : ""}That gives me a solid base to contribute quickly while continuing to deepen the areas your team seems to care about most, especially ${firstGap}.`,
    "",
    `${research.companySummary ? `${research.companySummary} ` : ""}That context makes the role even more interesting to me, because I want to work in an environment where ${roleSignal} actually matters to product decisions. I’d be excited to bring a thoughtful, hands-on approach and keep building stronger evidence at that level.`,
    "",
    "Sincerely,",
    context.candidate.name || ""
  ].join("\n");

  const prompt = buildCoverLetterAgentPrompt(context, resume, job, research, gap);
  const response = await invokeRoleForgeAgent<CoverLetterAgentOutput>(
    "cover-letter-agent",
    prompt.system,
    prompt.user
  );
  const modelLetter =
    typeof response.output?.coverLetter === "string" ? response.output.coverLetter : "";
  const usedFallback = !response.output || needsFallback(modelLetter);

  return {
    agent: "cover-letter-agent",
    mode: "llm",
    model: response.model,
    usedFallback,
    output: {
      openingHook:
        (typeof response.output?.openingHook === "string" ? response.output.openingHook : null) ??
        `Your ${role} opening at ${company} stands out because it directly connects ${businessNeed} with measurable product impact.`,
      keySellingPoints:
        normalizeStringArray(response.output?.keySellingPoints).length > 0
          ? normalizeStringArray(response.output?.keySellingPoints)
          : sellingPoints,
      coverLetter: !usedFallback ? modelLetter : fallbackLetter
    },
    notes: response.output && !usedFallback
      ? ["Cover Letter Agent used its own model call to draft a JD-aware application letter."]
      : ["Cover Letter Agent fell back because the model response was unavailable or still sounded too generic."]
  };
}
