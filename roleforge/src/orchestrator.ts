import { runCoverLetterAgent } from "./agents/cover-letter-agent.js";
import { runCoverLetterHumanizerAgent } from "./agents/cover-letter-humanizer-agent.js";
import { runGapAgent } from "./agents/gap-agent.js";
import { runJobAgent } from "./agents/job-agent.js";
import { runResearchAgent } from "./agents/research-agent.js";
import { runResumeAgent } from "./agents/resume-agent.js";
import { runRewriteAgent } from "./agents/rewrite-agent.js";
import { runReviewAgent } from "./agents/review-agent.js";
import { buildNlpSignals } from "./nlp.js";
import { persistRun } from "./persistence.js";
import { buildRetrievalContext } from "./retrieval.js";
import type { AgentContext, RoleForgeRun } from "./types.js";

export async function runRoleForge(context: AgentContext): Promise<RoleForgeRun> {
  const id = `run_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const nlp = buildNlpSignals(context);
  const enrichedContext: AgentContext = {
    ...context,
    nlp
  };
  const retrieval = await buildRetrievalContext(enrichedContext);
  enrichedContext.retrieval = retrieval;

  const [resume, job, research] = await Promise.all([
    runResumeAgent(enrichedContext),
    runJobAgent(enrichedContext),
    runResearchAgent(enrichedContext)
  ]);
  const gap = await runGapAgent(resume.output, job.output, nlp);
  const [rewrite, coverLetter] = await Promise.all([
    runRewriteAgent(enrichedContext, resume.output, gap.output),
    runCoverLetterAgent(
      enrichedContext,
      resume.output,
      job.output,
      research.output,
      gap.output
    )
  ]);
  const coverLetterHumanizer = await runCoverLetterHumanizerAgent(
    enrichedContext,
    coverLetter.output,
    job.output,
    gap.output
  );
  const review = await runReviewAgent(coverLetterHumanizer.output);

  const run: RoleForgeRun = {
    id,
    createdAt,
    request: {
      userId: context.auth?.userId || "",
      candidateName: context.candidate.name || resume.output.identityHints[0] || "Unknown candidate",
      companyName: context.target.companyName || "Unknown company",
      targetRole: context.target.targetRole || "Unknown role"
    },
    nlp,
    retrieval,
    resume,
    job,
    research,
    gap,
    rewrite,
    coverLetter,
    coverLetterHumanizer,
    review,
    trace: [
      { agent: resume.agent, model: resume.model, usedFallback: resume.usedFallback, notes: resume.notes, output: resume.output },
      { agent: job.agent, model: job.model, usedFallback: job.usedFallback, notes: job.notes, output: job.output },
      { agent: research.agent, model: research.model, usedFallback: research.usedFallback, notes: research.notes, output: research.output },
      { agent: gap.agent, model: gap.model, usedFallback: gap.usedFallback, notes: gap.notes, output: gap.output },
      { agent: rewrite.agent, model: rewrite.model, usedFallback: rewrite.usedFallback, notes: rewrite.notes, output: rewrite.output },
      { agent: coverLetter.agent, model: coverLetter.model, usedFallback: coverLetter.usedFallback, notes: coverLetter.notes, output: coverLetter.output },
      { agent: coverLetterHumanizer.agent, model: coverLetterHumanizer.model, usedFallback: coverLetterHumanizer.usedFallback, notes: coverLetterHumanizer.notes, output: coverLetterHumanizer.output },
      { agent: review.agent, model: review.model, usedFallback: review.usedFallback, notes: review.notes, output: review.output }
    ]
  };

  await persistRun(run);
  return run;
}
