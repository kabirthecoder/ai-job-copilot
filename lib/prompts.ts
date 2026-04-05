import type { CompanyResearch } from "@/lib/types";

export type CopilotAnalysisInput = {
  name?: string;
  email?: string;
  targetRole?: string;
  resumeText: string;
  jobDescription: string;
  companyName?: string;
  companyWebsite?: string;
  companyResearch?: CompanyResearch;
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

function shortResumeFocus(resumeText: string) {
  const cleaned = cleanText(resumeText);
  if (!cleaned) {
    return "software, data, and AI-oriented project work";
  }

  const sentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return sentence.slice(0, 180);
}

export function buildEnhancementPrompt(input: CopilotAnalysisInput): CopilotPromptBundle {
  const nameLine = input.name ? `Candidate name: ${cleanText(input.name)}\n` : "";
  const emailLine = input.email ? `Candidate email: ${cleanText(input.email)}\n` : "";
  const roleLine = input.targetRole ? `Target role: ${cleanText(input.targetRole)}\n` : "";
  const companyLine = input.companyName ? `Target company: ${cleanText(input.companyName)}\n` : "";
  const researchBlock =
    input.companyResearch && input.companyResearch.status !== "not_requested"
      ? [
          block("Company summary", input.companyResearch.companySummary || "No company summary found."),
          block("Role summary", input.companyResearch.roleSummary || "No role summary found."),
          block(
            "Latest achievements",
            input.companyResearch.latestAchievements.join("\n") || "No verified achievement signal found."
          ),
          block(
            "Hiring signals",
            input.companyResearch.hiringSignals.join("\n") || "No extra hiring signal found."
          )
        ].join("\n\n")
      : "";

  return {
    system:
      "You are an expert career copilot. Return concise, practical JSON only. Be specific, grounded in the resume, job description, and company research. Draft like a thoughtful human, not a generic template. Never invent facts about the candidate or company.",
    user: [
      `${nameLine}${emailLine}${roleLine}${companyLine}Return a JSON object with these exact keys: summary, suggestedProjects, interviewQuestions, nextSteps, recruiterTips, coverLetterSnippet, coldEmailSnippet, portfolioPitch.`,
      block("Resume", input.resumeText),
      block("Job description", input.jobDescription),
      researchBlock,
      "Rules:",
      "1. summary must be 2 short sentences.",
      "2. suggestedProjects must be an array of exactly 3 strings.",
      "3. interviewQuestions must be an array of exactly 3 strings.",
      "4. nextSteps must be an array of exactly 3 strings.",
      "5. recruiterTips must be an array of exactly 3 strings.",
      "6. coverLetterSnippet must be a ready-to-use full cover letter with greeting, 3 to 4 short paragraphs, and a sign-off.",
      "7. coverLetterSnippet must sound human, must reference the candidate's real background from the resume, and should naturally reference one verified company achievement or direction if available.",
      "8. coverLetterSnippet must explain why this role matters specifically to the candidate instead of sounding like a reusable template.",
      "9. coldEmailSnippet must be a short outreach note tailored to this company and role, not a reusable template.",
      "10. portfolioPitch must describe the candidate's relevant background or strongest portfolio direction for this role. Do not assume the candidate built this app unless the resume explicitly says so.",
      "11. Do not claim years of experience, project outcomes, or production work unless the resume clearly supports them.",
      "12. If company research is weak or failed, use only the job description and avoid pretending to know recent company news.",
      "13. Keep the cover letter substantial enough that a user could realistically copy, edit lightly, and apply with it.",
      "14. Do not include markdown fences or any extra commentary outside the JSON."
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

export function buildFallbackEnhancements(input: CopilotAnalysisInput): CopilotEnhancementOutput {
  const role = cleanText(input.targetRole || "AI Engineer");
  const company = cleanText(input.companyName || "the company");
  const name = input.name?.trim();
  const email = input.email?.trim();
  const matchedAchievement = input.companyResearch?.latestAchievements?.[0];
  const resumeFocus = shortResumeFocus(input.resumeText);
  const companyDirection =
    matchedAchievement ||
    input.companyResearch?.companySummary ||
    `the way ${company} is building in this space`;
  const motivationLine = matchedAchievement
    ? `I was especially interested to see ${matchedAchievement.toLowerCase()}, because it points to a team that is actively investing in meaningful product and technical progress.`
    : `I am especially interested in ${companyDirection}, and I would value the chance to contribute to that direction through thoughtful, execution-focused work.`;

  return {
    summary: `${name ? `${name}, ` : ""}this analysis highlights how your background maps to ${role} expectations and where a stronger portfolio narrative would sharpen your fit for ${company}. The strongest gains now come from turning missing themes into visible, role-specific work samples.`,
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
    coverLetterSnippet: [
      `Dear Hiring Team at ${company},`,
      `I am writing to express my interest in the ${role} opportunity. ${motivationLine}`,
      `My background has been shaped by building software and AI projects that focus on turning messy inputs into useful decisions and clearer user experiences. I am especially motivated by roles where I can combine implementation, experimentation, and iteration rather than treating modeling work as separate from product outcomes.`,
      `What makes this role compelling to me is the chance to contribute with curiosity, ownership, and a builder's mindset while continuing to deepen the areas that matter most for the team. I would be excited to bring that energy to ${company} and keep growing through the real challenges this role presents.`,
      ["Sincerely,", name ?? "Your candidate name", email ?? ""].filter(Boolean).join("\n")
    ].join("\n\n"),
    coldEmailSnippet: `Hi ${company} team, I’m reaching out because the ${role} opportunity feels closely aligned with the kind of work I want to keep building toward. My background includes ${resumeFocus.toLowerCase()}, and I’d be glad to share a few examples that feel especially relevant to the problems your team is solving.`,
    portfolioPitch: `My strongest portfolio direction for this ${role} path is work that shows practical problem solving, clear technical ownership, and visible business impact. The most relevant thread from my background is ${resumeFocus.toLowerCase()}.`
  };
}
