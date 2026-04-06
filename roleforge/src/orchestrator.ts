import { runCoverLetterAgent } from "./agents/cover-letter-agent";
import { runGapAgent } from "./agents/gap-agent";
import { runJobAgent } from "./agents/job-agent";
import { runResearchAgent } from "./agents/research-agent";
import { runResumeAgent } from "./agents/resume-agent";
import { runRewriteAgent } from "./agents/rewrite-agent";
import { runReviewAgent } from "./agents/review-agent";
import type { AgentContext, RoleForgeRun } from "./types";

export async function runRoleForge(context: AgentContext): Promise<RoleForgeRun> {
  const resume = await runResumeAgent(context);
  const job = await runJobAgent(context);
  const research = await runResearchAgent(context);
  const gap = await runGapAgent(resume.output, job.output);
  const rewrite = await runRewriteAgent(context, resume.output, gap.output);
  const coverLetter = await runCoverLetterAgent(
    context,
    resume.output,
    job.output,
    research.output,
    gap.output
  );
  const review = await runReviewAgent(coverLetter.output);

  return {
    resume,
    job,
    research,
    gap,
    rewrite,
    coverLetter,
    review
  };
}
