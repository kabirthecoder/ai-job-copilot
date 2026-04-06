import { invokeRoleForgeAgent } from "../llm";
import { buildGapAgentPrompt } from "../prompts";
import type {
  AgentResult,
  GapAgentOutput,
  JobAgentOutput,
  ResumeAgentOutput
} from "../types";

export async function runGapAgent(
  resume: ResumeAgentOutput,
  job: JobAgentOutput
): Promise<AgentResult<GapAgentOutput>> {
  const fallbackOutput: GapAgentOutput = {
    strengths: job.mustHaves.filter((skill) => resume.skills.includes(skill)),
    gaps: job.mustHaves.filter((skill) => !resume.skills.includes(skill)),
    focusAreas: job.mustHaves.filter((skill) => !resume.skills.includes(skill)).slice(0, 3)
  };
  const prompt = buildGapAgentPrompt(resume, job);
  const response = await invokeRoleForgeAgent<GapAgentOutput>(
    "gap-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "gap-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: response.output ?? fallbackOutput,
    notes: response.output
      ? ["Gap Agent used its own model call to compare profile strengths, gaps, and focus areas."]
      : ["Gap Agent fell back to deterministic comparison because the model response was unavailable."]
  };
}
