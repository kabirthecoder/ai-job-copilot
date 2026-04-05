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
  "testing",
  "a/b testing",
  "experimental design",
  "statistics",
  "forecasting",
  "time series",
  "optimization",
  "recommendation systems",
  "pricing",
  "bandits",
  "reinforcement learning",
  "big data",
  "pandas",
  "scikit-learn",
  "monitoring"
];

const DOMAIN_THEMES = [
  "travel",
  "marketplace",
  "pricing",
  "revenue optimization",
  "recommendation",
  "forecasting",
  "experimentation",
  "real-time systems",
  "ml serving",
  "auctions",
  "e-commerce"
];

const LANGUAGE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "German", pattern: /\b(german|deutsch)\b/i },
  { label: "English", pattern: /\b(english|englisch)\b/i },
  { label: "French", pattern: /\b(french|franz[oö]sisch)\b/i },
  { label: "Spanish", pattern: /\b(spanish|spanisch)\b/i }
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSkills(text: string) {
  const normalized = normalize(text);
  return SKILL_KEYWORDS.filter((skill) => normalized.includes(skill));
}

function extractThemes(text: string) {
  const normalized = normalize(text);
  return DOMAIN_THEMES.filter((theme) => normalized.includes(theme));
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function extractLanguageRequirements(text: string) {
  const requirements: string[] = [];

  for (const { label, pattern } of LANGUAGE_PATTERNS) {
    if (!pattern.test(text)) {
      continue;
    }

    if (new RegExp(`(native|fluent|business fluent|professional|c1|c2|verhandlungssicher|flie[ßs]end|sehr gute)[^.!?\\n]{0,30}(?:${label.toLowerCase()}|${label === "German" ? "deutsch" : label.toLowerCase()})`, "i").test(text) ||
        new RegExp(`(?:${label.toLowerCase()}|${label === "German" ? "deutsch" : label.toLowerCase()})[^.!?\\n]{0,30}(native|fluent|business fluent|professional|c1|c2|verhandlungssicher|flie[ßs]end|sehr gute)`, "i").test(text)) {
      requirements.push(`${label} (strong professional level)`);
      continue;
    }

    requirements.push(label);
  }

  return unique(requirements);
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function detectSeniority(text: string) {
  const normalized = normalize(text);

  if (
    normalized.includes("5+ years") ||
    normalized.includes("senior") ||
    normalized.includes("lead") ||
    normalized.includes("mentor")
  ) {
    return "Senior";
  }

  if (normalized.includes("3+ years") || normalized.includes("mid-level")) {
    return "Mid-level";
  }

  return "Unspecified";
}

function detectRoleFamily(text: string, targetRole?: string) {
  const normalized = normalize(`${targetRole ?? ""} ${text}`);

  if (normalized.includes("data scientist") || normalized.includes("applied scientist")) {
    return "Data / Applied Science";
  }

  if (normalized.includes("machine learning engineer") || normalized.includes("ml engineer")) {
    return "Machine Learning Engineering";
  }

  if (normalized.includes("ai engineer")) {
    return "AI Engineering";
  }

  if (normalized.includes("data analyst")) {
    return "Analytics";
  }

  return "General AI / Data";
}

function splitMustAndNice(text: string) {
  const normalized = normalize(text);
  const standOutIndex = normalized.indexOf("stand out with");
  const mustSection = standOutIndex >= 0 ? normalized.slice(0, standOutIndex) : normalized;
  const niceSection = standOutIndex >= 0 ? normalized.slice(standOutIndex) : "";

  const mustHaveSkills = unique(extractSkills(mustSection)).map(titleCase);
  const niceToHaveSkills = unique(extractSkills(niceSection)).map(titleCase);

  return { mustHaveSkills, niceToHaveSkills };
}

function extractRelevantExperience(resumeText: string, jobThemes: string[], matchedSkills: string[]) {
  const normalizedResume = normalize(resumeText);
  const experience: string[] = [];

  if (matchedSkills.includes("Python")) {
    experience.push("You already show Python experience, which remains the core language signal for this role.");
  }

  if (matchedSkills.includes("Sql")) {
    experience.push("Your profile already includes SQL, which helps for analytical work and production data workflows.");
  }

  if (normalizedResume.includes("llm") || normalizedResume.includes("rag")) {
    experience.push("Your current profile already signals applied AI work through LLM or retrieval-related experience.");
  }

  if (jobThemes.includes("pricing") && normalizedResume.includes("recruitment system")) {
    experience.push("Your matching-system experience is relevant because it shows decision logic and ranking intuition, even if it is not pricing-specific yet.");
  }

  if (normalizedResume.includes("docker")) {
    experience.push("Existing Docker experience helps support production-readiness and deployment credibility.");
  }

  return unique(experience).slice(0, 3);
}

function buildGapClosingProjects(
  roleFamily: string,
  themes: string[],
  missingSkills: string[],
  companyName: string
) {
  const ideas: string[] = [];

  if (themes.includes("pricing") || themes.includes("revenue optimization")) {
    ideas.push(
      `Build a dynamic pricing simulator for ${companyName} style marketplaces with scenario testing, elasticity assumptions, and policy comparison dashboards.`
    );
  }

  if (themes.includes("forecasting") || missingSkills.includes("Time Series")) {
    ideas.push(
      "Create a time-series forecasting pipeline with feature tracking, model evaluation, and monitoring for demand or price prediction."
    );
  }

  if (themes.includes("experimentation") || missingSkills.includes("A/B Testing")) {
    ideas.push(
      "Ship an experimentation analytics platform that evaluates A/B tests, simulates impact, and explains trade-offs to product stakeholders."
    );
  }

  if (themes.includes("recommendation") || missingSkills.includes("Recommendation Systems")) {
    ideas.push(
      "Build a recommendation and ranking service that scores offers in real time and compares ranking strategies with offline evaluation."
    );
  }

  if (themes.includes("real-time systems") || missingSkills.includes("Optimization")) {
    ideas.push(
      "Develop a real-time ML decision service with caching, latency tracking, and fallback policies for production-style inference."
    );
  }

  if (ideas.length === 0) {
    ideas.push(
      `Build a role-focused ${roleFamily.toLowerCase()} portfolio project that converts one major missing skill into a visible production-style artifact.`
    );
  }

  return unique(ideas).slice(0, 3);
}

function buildResumeFocusSnippet(resumeText: string, matchedSkills: string[]) {
  if (matchedSkills.length) {
    return `work involving ${matchedSkills.slice(0, 3).map(titleCase).join(", ")}`;
  }

  const cleaned = normalize(resumeText).split(/[.!?]/)[0]?.trim() || "software and analytics work";
  return cleaned.slice(0, 140);
}

export function analyzeProfile(input: AnalysisInput): AnalysisResult {
  const resumeSkills = unique(extractSkills(input.resumeText));
  const jobSkills = unique(extractSkills(input.jobDescription));
  const jobThemes = unique(extractThemes(input.jobDescription)).map(titleCase);
  const seniority = detectSeniority(input.jobDescription);
  const roleFamily = detectRoleFamily(input.jobDescription, input.targetRole);
  const { mustHaveSkills, niceToHaveSkills } = splitMustAndNice(input.jobDescription);
  const languageRequirements = extractLanguageRequirements(input.jobDescription);

  const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
  const scoreBase =
    jobSkills.length === 0 ? 45 : Math.round((matchedSkills.length / jobSkills.length) * 100);
  const score = Math.max(35, Math.min(95, scoreBase + Math.min(resumeSkills.length, 6)));

  const leadGap = missingSkills[0] ?? "llm";
  const role = input.targetRole?.trim() || "AI Engineer";
  const name = input.name?.trim();
  const email = input.email?.trim();
  const companyName = input.companyName?.trim() || "the company";
  const personalizedPrefix = name ? `${name}, ` : "";
  const atsScore = Math.max(38, Math.min(97, score + (matchedSkills.length >= 3 ? 4 : 0)));
  const relevantExperience = extractRelevantExperience(
    input.resumeText,
    jobThemes.map((theme) => theme.toLowerCase()),
    matchedSkills.map(titleCase)
  );
  const newProjectIdeas = buildGapClosingProjects(
    roleFamily,
    jobThemes.map((theme) => theme.toLowerCase()),
    missingSkills.map(titleCase),
    companyName
  );

  const suggestedProjects = [
    ...newProjectIdeas
  ];
  const resumeFocusSnippet = buildResumeFocusSnippet(input.resumeText, matchedSkills);

  const interviewQuestions = [
    `How would you design and evaluate a production-grade system for the ${role.toLowerCase()} problems described in this job?`,
    `What trade-offs would you make between experimentation speed, model complexity, and business impact for this role family?`,
    `How would you prove that your solution is working through metrics, monitoring, and stakeholder communication?`
  ];

  const nextSteps = [
    `Prioritize one gap-closing project around ${titleCase(leadGap)} or ${jobThemes[0] ?? "production ML"} and package it with a short case study.`,
    "Rewrite your most relevant resume bullets so they explicitly mirror the job's production, experimentation, and impact language.",
    "Prepare two stories about model delivery, evaluation, and cross-functional influence so your interview examples match the role level."
  ];

  const recruiterTips = [
    `Mirror the job language around ${titleCase(leadGap)} in your top resume bullets and portfolio README.`,
    `Quantify one project result for ${companyName} style roles, even if it is a personal project with user, latency, or cost metrics.`,
    `Show one end-to-end AI workflow that combines product UX, backend logic, and evaluation instead of listing only tools.`
  ];

  const summary = `${personalizedPrefix}your profile currently matches ${matchedSkills.length} of ${jobSkills.length || 0} detected job skills for a ${seniority.toLowerCase()} ${roleFamily.toLowerCase()} role. The strongest next step is a targeted project that closes gaps like ${titleCase(
    leadGap
  )} while making your fit for themes such as ${jobThemes.slice(0, 2).join(" and ") || "production ML"} much more obvious.`;
  const coverLetterBody = [
    `Dear Hiring Team at ${companyName},`,
    `I am writing to express my interest in the ${role} opportunity. What draws me most to this role is the chance to work on meaningful, product-facing problems while continuing to deepen my strengths in ${titleCase(
      leadGap
    )} and related areas that matter for long-term impact.`,
    `My current work has pushed me to build practical systems around ${titleCase(
      matchedSkills[0] ?? "software engineering"
    )}, and I enjoy roles that require thoughtful implementation, iteration, and clear communication rather than isolated technical work. That is why the emphasis on production-minded execution and useful outcomes feels especially aligned with how I like to contribute.`,
    `I would value the chance to bring that mindset to ${companyName}, while continuing to grow through the real technical and product challenges this role presents. The combination of technical depth, learning, and visible user impact is what makes this opportunity genuinely exciting to me.`,
    ["Sincerely,", name ?? "Your candidate name", email ?? ""].filter(Boolean).join("\n")
  ].join("\n\n");

  return {
    score,
    summary,
    matchedSkills: matchedSkills.map(titleCase),
    missingSkills: missingSkills.map(titleCase),
    languageRequirements,
    suggestedProjects,
    relevantExperience,
    newProjectIdeas,
    interviewQuestions,
    nextSteps,
    atsScore,
    recruiterTips,
    coverLetterSnippet: coverLetterBody,
    coldEmailSnippet: `Hi ${companyName} team, I’m reaching out because the ${role} opportunity feels closely aligned with the kind of work I want to keep building toward. My background includes ${resumeFocusSnippet}, and I’d be glad to share a few examples that feel especially relevant to this role.`,
    portfolioPitch: `My strongest portfolio direction for this ${role} path is work that shows practical problem solving, clear technical ownership, and visible impact. The most relevant thread from my background is ${resumeFocusSnippet}.`,
    seniority,
    roleFamily,
    domainFocus: jobThemes,
    mustHaveSkills,
    niceToHaveSkills
  };
}
