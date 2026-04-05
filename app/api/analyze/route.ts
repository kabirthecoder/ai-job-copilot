import { NextResponse } from "next/server";
import { analyzeProfile } from "@/lib/analyze";
import { generateCopilotEnhancements } from "@/lib/llm";
import { buildFallbackEnhancements } from "@/lib/prompts";
import { researchCompany } from "@/lib/research";

function isUsableCoverLetter(value: string) {
  const trimmed = value.trim();
  const paragraphCount = trimmed.split(/\n\s*\n/).filter(Boolean).length;
  const weakPatterns = [/^as a\b/i, /\bi am to\b/i, /\byour background\b/i];

  return trimmed.length >= 650 && paragraphCount >= 4 && !weakPatterns.some((pattern) => pattern.test(trimmed));
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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    targetRole?: string;
    resumeText?: string;
    jobDescription?: string;
    companyName?: string;
    companyWebsite?: string;
    enableCompanyResearch?: boolean;
  };

  if (!body.resumeText?.trim() || !body.jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Resume text and job description are both required." },
      { status: 400 }
    );
  }

  const input = {
    name: body.name,
    email: body.email,
    targetRole: body.targetRole,
    resumeText: body.resumeText,
    jobDescription: body.jobDescription,
    companyName: body.companyName,
    companyWebsite: body.companyWebsite,
    enableCompanyResearch: body.enableCompanyResearch
  };

  const baseResult = analyzeProfile(input);
  const companyResearch = await researchCompany(input);
  const llmResult = await generateCopilotEnhancements({
    ...input,
    companyResearch
  });
  const fallbackDraft = buildFallbackEnhancements({
    ...input,
    companyResearch
  });

  const result = {
    ...baseResult,
    summary: llmResult.summary || baseResult.summary,
    suggestedProjects: llmResult.suggestedProjects.length
      ? llmResult.suggestedProjects
      : baseResult.suggestedProjects,
    interviewQuestions: llmResult.interviewQuestions.length
      ? llmResult.interviewQuestions
      : baseResult.interviewQuestions,
    nextSteps: llmResult.nextSteps.length ? llmResult.nextSteps : baseResult.nextSteps,
    recruiterTips: llmResult.recruiterTips.length ? llmResult.recruiterTips : baseResult.recruiterTips,
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

  return NextResponse.json(result);
}
