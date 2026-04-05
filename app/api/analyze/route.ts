import { NextResponse } from "next/server";
import { analyzeProfile } from "@/lib/analyze";
import { generateCopilotEnhancements } from "@/lib/llm";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    targetRole?: string;
    resumeText?: string;
    jobDescription?: string;
    companyName?: string;
  };

  if (!body.resumeText?.trim() || !body.jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Resume text and job description are both required." },
      { status: 400 }
    );
  }

  const input = {
    name: body.name,
    targetRole: body.targetRole,
    resumeText: body.resumeText,
    jobDescription: body.jobDescription,
    companyName: body.companyName
  };

  const baseResult = analyzeProfile(input);
  const llmResult = await generateCopilotEnhancements(input);

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
    coverLetterSnippet: llmResult.coverLetterSnippet || baseResult.coverLetterSnippet,
    coldEmailSnippet: llmResult.coldEmailSnippet || baseResult.coldEmailSnippet,
    portfolioPitch: llmResult.portfolioPitch || baseResult.portfolioPitch,
    provider: llmResult.provider,
    model: llmResult.model
  };

  return NextResponse.json(result);
}
