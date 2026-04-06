import { analyzeProfile } from "@/lib/analyze";
import { generateCopilotEnhancements } from "@/lib/llm";
import { buildFallbackEnhancements } from "@/lib/prompts";
import { researchCompany } from "@/lib/research";
import type { AnalysisInput, AnalysisResult, AgentStep, AgentSystemTrace } from "@/lib/types";

function isUsableCoverLetter(value: string) {
  const trimmed = value.trim();
  const paragraphCount = trimmed.split(/\n\s*\n/).filter(Boolean).length;
  const weakPatterns = [/^as a\b/i, /\bi am to\b/i, /\byour background\b/i];

  return (
    trimmed.length >= 650 &&
    paragraphCount >= 4 &&
    !weakPatterns.some((pattern) => pattern.test(trimmed))
  );
}

function isGenericOutreach(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("ai career copilot") ||
    normalized.includes("resume-job fit") ||
    normalized.includes("tailored application materials") ||
    normalized.includes("built an ai research + job copilot")
  );
}

function buildAgentSystemTrace(steps: AgentStep[]): AgentSystemTrace {
  return {
    mode: "multi-agent",
    agents: [
      "Resume Agent",
      "Job Agent",
      "Research Agent",
      "Gap Agent",
      "Drafting Agent",
      "Review Agent"
    ],
    completedSteps: steps
  };
}

function sentenceFragments(text: string) {
  return text
    .split(/[\n.!?]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24);
}

function rewriteResumeBullets(input: AnalysisInput, baseResult: AnalysisResult) {
  const role = input.targetRole?.trim() || "target role";
  const company = input.companyName?.trim() || "the team";
  const themes = baseResult.domainFocus?.slice(0, 2).join(" and ") || "practical AI delivery";
  const sourceLines = sentenceFragments(input.resumeText).slice(0, 3);

  const bullets = sourceLines.map((line, index) => {
    if (index === 0) {
      return `Built and delivered ${line.charAt(0).toLowerCase()}${line.slice(1)}, showing hands-on ownership that maps well to ${role.toLowerCase()} work at ${company}.`;
    }

    if (index === 1) {
      return `Applied ${themes.toLowerCase()} thinking through ${line.charAt(0).toLowerCase()}${line.slice(1)}, with a focus on turning technical work into useful outcomes.`;
    }

    return `Strengthened end-to-end product and engineering judgment through ${line.charAt(0).toLowerCase()}${line.slice(1)}, creating stronger evidence for this role's execution needs.`;
  });

  while (bullets.length < 3) {
    bullets.push(
      `Built portfolio work that connects implementation, iteration, and measurable value, creating stronger proof of fit for ${role.toLowerCase()} opportunities.`
    );
  }

  return bullets.slice(0, 3);
}

export async function orchestrateRoleForgeAnalysis(
  input: AnalysisInput
): Promise<AnalysisResult> {
  const steps: AgentStep[] = [];

  steps.push({
    id: "resume-agent",
    title: "Resume Agent",
    status: "completed",
    summary: "Parsed the uploaded resume text into candidate identity and experience signals."
  });

  steps.push({
    id: "job-agent",
    title: "Job Agent",
    status: "completed",
    summary: "Extracted role expectations, skill requirements, seniority, and domain focus from the JD."
  });

  const baseResult = analyzeProfile(input);
  const rewrittenResumeBullets = rewriteResumeBullets(input, baseResult);

  steps.push({
    id: "gap-agent",
    title: "Gap Agent",
    status: "completed",
    summary: `Compared the candidate profile against the target role and found ${baseResult.matchedSkills.length} matched skills with ${baseResult.missingSkills.length} visible gaps.`
  });

  steps.push({
    id: "resume-rewrite-agent",
    title: "Resume Rewrite Agent",
    status: "completed",
    summary: "Reframed existing resume content into stronger, role-aware bullets that are easier to reuse in applications."
  });

  const companyResearch = await researchCompany(input);
  steps.push({
    id: "research-agent",
    title: "Research Agent",
    status:
      companyResearch.status === "failed"
        ? "fallback"
        : companyResearch.status === "not_requested"
          ? "skipped"
          : "completed",
    summary:
      companyResearch.status === "failed"
        ? "Could not fetch clean public company pages, so drafting will rely mostly on the job description."
        : companyResearch.status === "not_requested"
          ? "Skipped company research because research mode was turned off."
          : "Collected company context and role signals from public sources to improve personalization."
  });

  const llmResult = await generateCopilotEnhancements({
    ...input,
    companyResearch
  });
  const fallbackDraft = buildFallbackEnhancements({
    ...input,
    companyResearch
  });

  steps.push({
    id: "drafting-agent",
    title: "Drafting Agent",
    status: llmResult.provider === "mock" ? "fallback" : "completed",
    summary:
      llmResult.provider === "mock"
        ? "Used the deterministic drafting fallback because a stronger live model response was unavailable."
        : `Generated narrative outputs using ${llmResult.provider} for richer personalization.`
  });

  const result: AnalysisResult = {
    ...baseResult,
    rewrittenResumeBullets,
    summary: llmResult.summary || baseResult.summary,
    suggestedProjects: llmResult.suggestedProjects.length
      ? llmResult.suggestedProjects
      : baseResult.suggestedProjects,
    interviewQuestions: llmResult.interviewQuestions.length
      ? llmResult.interviewQuestions
      : baseResult.interviewQuestions,
    nextSteps: llmResult.nextSteps.length ? llmResult.nextSteps : baseResult.nextSteps,
    recruiterTips: llmResult.recruiterTips.length
      ? llmResult.recruiterTips
      : baseResult.recruiterTips,
    coverLetterSnippet: isUsableCoverLetter(llmResult.coverLetterSnippet)
      ? llmResult.coverLetterSnippet
      : fallbackDraft.coverLetterSnippet || baseResult.coverLetterSnippet,
    coldEmailSnippet:
      llmResult.coldEmailSnippet && !isGenericOutreach(llmResult.coldEmailSnippet)
        ? llmResult.coldEmailSnippet
        : fallbackDraft.coldEmailSnippet || baseResult.coldEmailSnippet,
    portfolioPitch:
      llmResult.portfolioPitch && !isGenericOutreach(llmResult.portfolioPitch)
        ? llmResult.portfolioPitch
        : fallbackDraft.portfolioPitch || baseResult.portfolioPitch,
    companyResearch,
    provider: llmResult.provider,
    model: llmResult.model
  };

  steps.push({
    id: "review-agent",
    title: "Review Agent",
    status:
      result.coverLetterSnippet === llmResult.coverLetterSnippet &&
      result.coldEmailSnippet === llmResult.coldEmailSnippet &&
      result.portfolioPitch === llmResult.portfolioPitch
        ? "completed"
        : "fallback",
    summary:
      result.coverLetterSnippet === llmResult.coverLetterSnippet &&
      result.coldEmailSnippet === llmResult.coldEmailSnippet &&
      result.portfolioPitch === llmResult.portfolioPitch
        ? "Approved the generated drafts without fallback replacement."
        : "Replaced weak or generic draft outputs with stronger deterministic fallbacks."
  });

  return {
    ...result,
    agentSystem: buildAgentSystemTrace(steps)
  };
}
