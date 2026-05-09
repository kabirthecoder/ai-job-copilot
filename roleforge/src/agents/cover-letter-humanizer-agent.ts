import { invokeRoleForgeAgent } from "../llm.js";
import { buildCoverLetterHumanizerPrompt } from "../prompts.js";
import type {
  AgentContext,
  AgentResult,
  CoverLetterAgentOutput,
  CoverLetterHumanizerOutput,
  GapAgentOutput,
  JobAgentOutput
} from "../types.js";

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function humanizeFallback(draft: string) {
  return draft
    .replace(/I am writing to express my keen interest in /i, "What pulled me toward ")
    .replace(/I am writing to express my interest in /i, "What pulled me toward ")
    .replace(/Your ([^.]+) opportunity immediately caught my attention because it combines /i, "What pulled me toward this opportunity is the way it combines ")
    .replace(/My background already shows strength in /i, "I think my strongest starting point here is ")
    .replace(/I would position myself as someone who can /i, "What I would bring day to day is the ability to ")
    .replace(/Your esteemed organization excels in /i, "What also makes the role appealing to me is ")
    .replace(/I look forward to discussing this opportunity with you further\./i, "I’d welcome the chance to talk more about how I could contribute.");
}

export async function runCoverLetterHumanizerAgent(
  context: AgentContext,
  draft: CoverLetterAgentOutput,
  job: JobAgentOutput,
  gap: GapAgentOutput
): Promise<AgentResult<CoverLetterHumanizerOutput>> {
  const prompt = buildCoverLetterHumanizerPrompt(context, draft.coverLetter, job, gap);
  const response = await invokeRoleForgeAgent<CoverLetterHumanizerOutput>(
    "cover-letter-humanizer-agent",
    prompt.system,
    prompt.user
  );

  const fallbackOutput: CoverLetterHumanizerOutput = {
    coverLetter: humanizeFallback(draft.coverLetter),
    toneNotes: [
      "Softened template-like phrasing.",
      "Varied sentence openings to sound more natural.",
      "Kept the same factual content while making the tone more personal."
    ]
  };

  return {
    agent: "cover-letter-humanizer-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output:
      response.output
        ? {
            coverLetter:
              typeof response.output.coverLetter === "string"
                ? response.output.coverLetter
                : fallbackOutput.coverLetter,
            toneNotes: normalizeStringArray(response.output.toneNotes)
          }
        : fallbackOutput,
    notes: response.output && typeof response.output.coverLetter === "string" && response.output.coverLetter.length > 550
      ? ["Cover Letter Humanizer Agent rewrote the draft for more natural tone and variation."]
      : ["Cover Letter Humanizer Agent fell back to a local tone rewrite because the model response was unavailable or still too stiff."]
  };
}
