import type {
  AgentContext,
  CoverLetterHumanizerOutput,
  GapAgentOutput,
  JobAgentOutput,
  ResearchAgentOutput,
  ResumeAgentOutput
} from "./types.js";

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function retrievalSection(context: AgentContext) {
  const retrieval = context.retrieval;

  if (!retrieval || retrieval.hits.length === 0) {
    return "No retrieval hits available.";
  }

  return retrieval.hits
    .map((hit, index) => `${index + 1}. [${hit.source}] score=${hit.score.toFixed(3)} ${hit.text}`)
    .join("\n");
}

export function buildResumeAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Resume Agent in a multi-agent career system. Return JSON only. Extract a candidateHeadline, identityHints, skills, evidenceLines, and likelyProjects from the resume. Do not invent facts.",
    user: `Return JSON with keys candidateHeadline, identityHints, skills, evidenceLines, likelyProjects.\n\nResume:\n${context.candidate.resumeText}\n\nNLP signals:\n${JSON.stringify(context.nlp, null, 2)}`
  };
}

export function buildJobAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Job Agent in a multi-agent career system. Return JSON only. Parse the job description into seniority, roleFamily, mustHaves, niceToHaves, languageRequirements, businessNeeds, and successSignals.",
    user: `Return JSON with keys seniority, roleFamily, mustHaves, niceToHaves, languageRequirements, businessNeeds, successSignals.\n\nJob description:\n${context.target.jobDescription}\n\nNLP signals:\n${JSON.stringify(context.nlp, null, 2)}`
  };
}

export function buildResearchAgentPrompt(context: AgentContext) {
  return {
    system:
      "You are the Research Agent in a multi-agent career system. Return JSON only. Summarize company context conservatively from provided research snippets. Include roleContext. If evidence is weak, say so instead of inventing details.",
    user: `Return JSON with keys status, companySummary, latestSignals, sources, roleContext.\n\nCompany: ${clean(context.target.companyName || "Unknown")}\nWebsite: ${clean(context.target.companyWebsite || "Not provided")}\nJob description excerpt:\n${context.target.jobDescription.slice(0, 1500)}\n\nRetrieved context:\n${retrievalSection(context)}`
  };
}

export function buildGapAgentPrompt(
  resume: ResumeAgentOutput,
  job: JobAgentOutput
) {
  return {
    system:
      "You are the Gap Agent in a multi-agent career system. Return JSON only. Compare parsed resume and parsed job data and identify strengths, gaps, focusAreas, atsScore, targetAtsScore, matchedCount, missingCount, evidenceMap, applicationStrategy, and highPriorityFixes.",
    user: `Return JSON with keys strengths, gaps, focusAreas, atsScore, targetAtsScore, matchedCount, missingCount, evidenceMap, applicationStrategy, highPriorityFixes.\n\nResume data:\n${JSON.stringify(resume, null, 2)}\n\nJob data:\n${JSON.stringify(job, null, 2)}`
  };
}

export function buildRewriteAgentPrompt(
  context: AgentContext,
  resume: ResumeAgentOutput,
  gap: GapAgentOutput
) {
  return {
    system:
      "You are the Resume Rewrite Agent in a multi-agent career system. Return JSON only. Rewrite resume bullets to sound stronger for the role while staying faithful to the original evidence. Also produce a revisedSummary, projectedAtsScore, and a revisedResumeArtifact in markdown.",
    user: `Return JSON with keys rewrittenBullets, revisedSummary, projectedAtsScore, revisedResumeArtifact.\n\nTarget role: ${clean(context.target.targetRole || "Unknown")}\nResume evidence:\n${JSON.stringify(resume.evidenceLines, null, 2)}\n\nFocus areas:\n${JSON.stringify(gap.focusAreas, null, 2)}\n\nHigh priority fixes:\n${JSON.stringify(gap.highPriorityFixes, null, 2)}\n\nRetrieved context:\n${retrievalSection(context)}`
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
      "You are the Cover Letter Agent in a multi-agent career system. Return JSON only. Write a role-specific, natural, human-sounding cover letter that clearly responds to the job description and candidate profile. It must not read like a template. Avoid cliches such as 'I am writing to express my interest', 'I am excited to apply', and generic filler. Use the parsed must-haves, gaps, business needs, and research context explicitly. Make the voice personal, specific, and varied in sentence structure. Do not invent achievements. Also return an openingHook and keySellingPoints.",
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
    )}\n\nWriting requirements:
- 3 short paragraphs plus greeting/signoff
- mention 1 specific company or role signal when available
- lead with genuine motivation, not a generic opener
- include 2-3 concrete strengths from the candidate profile
- acknowledge at most one gap, and frame it as active growth
- avoid repeating exact wording from the JD
- do not sound overly polished, robotic, or corporate-template-like
\nReturn JSON with keys coverLetter, openingHook, keySellingPoints.\n\nNLP signals:\n${JSON.stringify(context.nlp, null, 2)}\n\nRetrieved context:\n${retrievalSection(context)}\n\nResume agent output:\n${JSON.stringify(resume, null, 2)}\n\nJob agent output:\n${JSON.stringify(job, null, 2)}\n\nResearch agent output:\n${JSON.stringify(research, null, 2)}\n\nGap agent output:\n${JSON.stringify(gap, null, 2)}`
  };
}

export function buildReviewAgentPrompt(coverLetter: string) {
  return {
    system:
      "You are the Review Agent in a multi-agent career system. Return JSON only. Evaluate whether the cover letter feels generic, unsupported, or too weak, and suggest a revised version only if needed. Return a finalRecommendation.",
    user: `Return JSON with keys approved, issues, revisedCoverLetter, finalRecommendation.\n\nCover letter:\n${coverLetter}`
  };
}

export function buildCoverLetterHumanizerPrompt(
  context: AgentContext,
  draft: string,
  job: JobAgentOutput,
  gap: GapAgentOutput
) {
  return {
    system:
      "You are the Cover Letter Humanizer Agent in a multi-agent career system. Return JSON only. Rewrite the draft so it sounds more human, personal, varied, and less templated while keeping the facts intact. Remove robotic phrasing, avoid repetitive sentence openings, and keep the writing grounded in the candidate's real profile. Do not invent experience. Return toneNotes explaining the rewrite choices.",
    user: `Return JSON with keys coverLetter and toneNotes.\n\nCandidate name: ${clean(
      context.candidate.name || "Unknown"
    )}\nTarget role: ${clean(context.target.targetRole || "Unknown")}\nCompany: ${clean(
      context.target.companyName || context.target.companyWebsite || "Unknown"
    )}\nJob business needs: ${JSON.stringify(job.businessNeeds, null, 2)}\nGap focus areas: ${JSON.stringify(
      gap.focusAreas,
      null,
      2
    )}\n\nDraft to humanize:\n${draft}`
  };
}
