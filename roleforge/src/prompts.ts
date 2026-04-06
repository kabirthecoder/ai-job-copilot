import type {
  AgentContext,
  GapAgentOutput,
  JobAgentOutput,
  ResearchAgentOutput,
  ResumeAgentOutput
} from "./types";

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildResumeAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Resume Agent in a multi-agent career system. Return JSON only. Extract identity hints, skills, and evidence lines from the resume. Do not invent facts.",
    user: `Return JSON with keys identityHints, skills, evidenceLines.\n\nResume:\n${context.candidate.resumeText}`
  };
}

export function buildJobAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Job Agent in a multi-agent career system. Return JSON only. Parse the job description into seniority, roleFamily, mustHaves, niceToHaves, and languageRequirements.",
    user: `Return JSON with keys seniority, roleFamily, mustHaves, niceToHaves, languageRequirements.\n\nJob description:\n${context.target.jobDescription}`
  };
}

export function buildResearchAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Research Agent in a multi-agent career system. Return JSON only. Summarize company context conservatively from provided research snippets. If evidence is weak, say so instead of inventing details.",
    user: `Return JSON with keys status, companySummary, latestSignals, sources.\n\nCompany: ${clean(context.target.companyName || "Unknown")}\nWebsite: ${clean(context.target.companyWebsite || "Not provided")}\nJob description excerpt:\n${context.target.jobDescription.slice(0, 1500)}`
  };
}

export function buildGapAgentPrompt(
  resume: ResumeAgentOutput,
  job: JobAgentOutput
) {
  return {
    system:
      "You are the Gap Agent in a multi-agent career system. Return JSON only. Compare parsed resume and parsed job data and identify strengths, gaps, and focusAreas.",
    user: `Return JSON with keys strengths, gaps, focusAreas.\n\nResume data:\n${JSON.stringify(resume, null, 2)}\n\nJob data:\n${JSON.stringify(job, null, 2)}`
  };
}

export function buildRewriteAgentPrompt(
  context: AgentContext,
  resume: ResumeAgentOutput,
  gap: GapAgentOutput
) {
  return {
    system:
      "You are the Resume Rewrite Agent in a multi-agent career system. Return JSON only. Rewrite resume bullets to sound stronger for the role while staying faithful to the original evidence.",
    user: `Return JSON with key rewrittenBullets.\n\nTarget role: ${clean(context.target.targetRole || "Unknown")}\nResume evidence:\n${JSON.stringify(resume.evidenceLines, null, 2)}\n\nFocus areas:\n${JSON.stringify(gap.focusAreas, null, 2)}`
  };
}

export function buildCoverLetterAgentPrompt(
  context: AgentContext,
  resume: ResumeAgentOutput,
  job: JobAgentOutput,
  research: ResearchAgentOutput,
  gap: GapAgentOutput
) {
  return {
    system:
      "You are the Cover Letter Agent in a multi-agent career system. Return JSON only. Write a role-specific, human-sounding cover letter that clearly responds to the job description and candidate profile. Avoid generic openings and do not invent achievements.",
    user: `Return JSON with key coverLetter.\n\nCandidate:\n${JSON.stringify(
      { name: context.candidate.name, email: context.candidate.email },
      null,
      2
    )}\n\nTarget:\n${JSON.stringify(
      {
        role: context.target.targetRole,
        company: context.target.companyName,
        website: context.target.companyWebsite
      },
      null,
      2
    )}\n\nResume agent output:\n${JSON.stringify(resume, null, 2)}\n\nJob agent output:\n${JSON.stringify(job, null, 2)}\n\nResearch agent output:\n${JSON.stringify(research, null, 2)}\n\nGap agent output:\n${JSON.stringify(gap, null, 2)}`
  };
}

export function buildReviewAgentPrompt(coverLetter: string) {
  return {
    system:
      "You are the Review Agent in a multi-agent career system. Return JSON only. Evaluate whether the cover letter feels generic, unsupported, or too weak, and suggest a revised version only if needed.",
    user: `Return JSON with keys approved, issues, revisedCoverLetter.\n\nCover letter:\n${coverLetter}`
  };
}
