export type CopilotAnalysisInput = {
  name?: string;
  targetRole?: string;
  resumeText: string;
  jobDescription: string;
  companyName?: string;
};

export type CopilotEnhancementOutput = {
  summary: string;
  suggestedProjects: string[];
  interviewQuestions: string[];
  nextSteps: string[];
  recruiterTips: string[];
  coverLetterSnippet: string;
  coldEmailSnippet: string;
  portfolioPitch: string;
};

export type CopilotPromptBundle = {
  system: string;
  user: string;
};

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function block(label: string, value: string) {
  return `${label}:\n${value.trim()}`;
}

export function buildEnhancementPrompt(input: CopilotAnalysisInput): CopilotPromptBundle {
  const nameLine = input.name ? `Candidate name: ${cleanText(input.name)}\n` : "";
  const roleLine = input.targetRole ? `Target role: ${cleanText(input.targetRole)}\n` : "";
  const companyLine = input.companyName ? `Target company: ${cleanText(input.companyName)}\n` : "";

  return {
    system:
      "You are an expert career copilot. Return concise, practical JSON only. Be specific, grounded in the resume and job description, and avoid filler.",
    user: [
      `${nameLine}${roleLine}${companyLine}Return a JSON object with these exact keys: summary, suggestedProjects, interviewQuestions, nextSteps, recruiterTips, coverLetterSnippet, coldEmailSnippet, portfolioPitch.`,
      block("Resume", input.resumeText),
      block("Job description", input.jobDescription),
      "Rules:",
      "1. summary must be 2 short sentences.",
      "2. suggestedProjects must be an array of exactly 3 strings.",
      "3. interviewQuestions must be an array of exactly 3 strings.",
      "4. nextSteps must be an array of exactly 3 strings.",
      "5. recruiterTips must be an array of exactly 3 strings.",
      "6. coverLetterSnippet, coldEmailSnippet, and portfolioPitch must each be one paragraph string.",
      "7. Do not include markdown fences or any extra commentary outside the JSON."
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

export function buildFallbackEnhancements(input: CopilotAnalysisInput): CopilotEnhancementOutput {
  const role = cleanText(input.targetRole || "AI Engineer");
  const company = cleanText(input.companyName || "the company");
  const name = input.name?.trim();
  const prefix = name ? `${name}, ` : "";

  return {
    summary: `${prefix}this mock analysis is ready for local development. Add an API key to enable live model scoring for ${role} resumes and job descriptions aimed at ${company}.`,
    suggestedProjects: [
      `Build a ${role} copilot with document upload, scorecards, and saved analyses.`,
      "Add a prompt evaluation dashboard that compares mock and live model outputs.",
      "Ship a skill-gap recommender that turns missing skills into project ideas."
    ],
    interviewQuestions: [
      "How would you keep LLM usage affordable while still giving useful recommendations?",
      "How would you measure whether the assistant's advice actually helped candidates?",
      "What parts of the workflow would you cache or precompute?"
    ],
    nextSteps: [
      "Wire this scaffold into the app's analysis route.",
      "Add PDF upload and extracted text as a second input path.",
      "Store analyses so the user can revisit and compare runs."
    ],
    recruiterTips: [
      "Mirror the job language more closely in your top bullet points.",
      "Quantify one or two project outcomes with speed, accuracy, or cost numbers.",
      "Show one project that combines product UX, backend logic, and AI evaluation."
    ],
    coverLetterSnippet: `I am excited about the ${role} opportunity because it combines practical software delivery with applied AI. My background and ongoing project work are helping me strengthen the exact product-building and experimentation mindset that ${company} values.`,
    coldEmailSnippet: `Hi team, I recently built an AI career copilot that analyzes resume-job fit, highlights skill gaps, and generates tailored application materials. I would love to share it because it reflects the kind of ${role.toLowerCase()} thinking your team is hiring for.`,
    portfolioPitch: `Built an AI Research + Job Copilot that blends rule-based fit scoring with model-assisted writing to generate project ideas, recruiter guidance, interview prep, and application drafts from resumes and job descriptions.`
  };
}
