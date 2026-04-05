import type { AnalysisInput, AnalysisResult } from "@/lib/types";

const SKILL_KEYWORDS = [
  "python",
  "java",
  "javascript",
  "typescript",
  "react",
  "next.js",
  "node.js",
  "express",
  "fastapi",
  "django",
  "sql",
  "postgresql",
  "mongodb",
  "redis",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "machine learning",
  "deep learning",
  "llm",
  "rag",
  "langchain",
  "vector database",
  "nlp",
  "pandas",
  "numpy",
  "scikit-learn",
  "tensorflow",
  "pytorch",
  "git",
  "rest api",
  "graphql",
  "data structures",
  "algorithms",
  "prompt engineering",
  "ci/cd",
  "testing"
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSkills(text: string) {
  const normalized = normalize(text);
  return SKILL_KEYWORDS.filter((skill) => normalized.includes(skill));
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function analyzeProfile(input: AnalysisInput): AnalysisResult {
  const resumeSkills = unique(extractSkills(input.resumeText));
  const jobSkills = unique(extractSkills(input.jobDescription));

  const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
  const scoreBase =
    jobSkills.length === 0 ? 45 : Math.round((matchedSkills.length / jobSkills.length) * 100);
  const score = Math.max(35, Math.min(95, scoreBase + Math.min(resumeSkills.length, 6)));

  const leadGap = missingSkills[0] ?? "llm";
  const role = input.targetRole?.trim() || "AI Engineer";
  const name = input.name?.trim();
  const companyName = input.companyName?.trim() || "the company";
  const personalizedPrefix = name ? `${name}, ` : "";
  const atsScore = Math.max(38, Math.min(97, score + (matchedSkills.length >= 3 ? 4 : 0)));

  const suggestedProjects = [
    `Build a ${titleCase(leadGap)} readiness tracker for ${role} roles with skill-gap analysis, personalized study plans, and a recruiter-facing dashboard.`,
    `Create a resume and job-description copilot that uses retrieval plus prompt templates to rewrite bullets, score ATS alignment, and explain why each recommendation was made.`,
    `Ship an interview prep workspace that generates role-specific mock interviews, captures answers, and scores them against job requirements with actionable feedback.`
  ];

  const interviewQuestions = [
    `How would you design a low-cost ${role.toLowerCase()} copilot that balances embeddings, retrieval, and selective LLM calls?`,
    `What trade-offs would you make between prompt-only extraction and schema-validated parsing for job and resume data?`,
    `How would you evaluate whether the recommendations produced by your assistant are actually useful to candidates?`
  ];

  const nextSteps = [
    `Prioritize closing the ${titleCase(leadGap)} gap with one project artifact, one short write-up, and one demo video.`,
    "Track each prompt and output pair so you can talk concretely about quality improvements in interviews.",
    "Add authentication, saved analyses, and exportable reports after the core recommendation loop feels solid."
  ];

  const recruiterTips = [
    `Mirror the job language around ${titleCase(leadGap)} in your top resume bullets and portfolio README.`,
    `Quantify one project result for ${companyName} style roles, even if it is a personal project with user, latency, or cost metrics.`,
    `Show one end-to-end AI workflow that combines product UX, backend logic, and evaluation instead of listing only tools.`
  ];

  const summary = `${personalizedPrefix}your profile currently matches ${matchedSkills.length} of ${jobSkills.length || 0} detected job skills. The strongest immediate signal for employers is a focused personal project that demonstrates ${titleCase(
    matchedSkills[0] ?? "applied AI"
  )} while directly addressing gaps like ${titleCase(leadGap)}.`;

  return {
    score,
    summary,
    matchedSkills: matchedSkills.map(titleCase),
    missingSkills: missingSkills.map(titleCase),
    suggestedProjects,
    interviewQuestions,
    nextSteps,
    atsScore,
    recruiterTips,
    coverLetterSnippet: `I am excited about the ${role} opportunity because it combines practical product building with applied AI. My recent work with ${titleCase(
      matchedSkills[0] ?? "software engineering"
    )} and my focus on strengthening ${titleCase(leadGap)} align well with the impact ${companyName} is aiming for.`,
    coldEmailSnippet: `Hi team, I recently built an AI career copilot that analyzes resume-job fit, identifies skill gaps, and generates tailored improvement plans. I would love to share the project because it reflects the kind of ${role.toLowerCase()} work your team is hiring for.`,
    portfolioPitch: `Built an AI Research + Job Copilot that compares resumes to job descriptions, surfaces ATS and recruiter insights, and generates targeted projects, outreach drafts, and interview preparation using a low-cost analysis pipeline.`
  };
}
