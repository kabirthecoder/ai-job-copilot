import { invokeRoleForgeAgent } from "../llm";
import { buildRewriteAgentPrompt } from "../prompts";
import type {
  AgentContext,
  AgentResult,
  GapAgentOutput,
  RewriteAgentOutput,
  ResumeAgentOutput
} from "../types";

export async function runRewriteAgent(
  context: AgentContext,
  resume: ResumeAgentOutput,
  gap: GapAgentOutput
): Promise<AgentResult<RewriteAgentOutput>> {
  const role = context.target.targetRole ?? "target role";
  const bullets = resume.evidenceLines.slice(0, 3).map((line, index) => {
    if (index === 0) {
      return `Built and delivered ${line.toLowerCase()}, creating stronger evidence for ${role.toLowerCase()} responsibilities.`;
    }

    return `Applied practical execution and iteration through ${line.toLowerCase()}, while building toward ${gap.focusAreas[0] ?? "higher-impact role requirements"}.`;
  });
  const prompt = buildRewriteAgentPrompt(context, resume, gap);
  const response = await invokeRoleForgeAgent<RewriteAgentOutput>(
    "rewrite-agent",
    prompt.system,
    prompt.user
  );

  return {
    agent: "rewrite-agent",
    mode: "llm",
    model: response.model,
    usedFallback: !response.output,
    output: response.output ?? { rewrittenBullets: bullets },
    notes: response.output
      ? ["Resume Rewrite Agent used its own model call to tailor the candidate's bullets to the role."]
      : ["Resume Rewrite Agent fell back to deterministic rewriting because the model response was unavailable."]
  };
}
