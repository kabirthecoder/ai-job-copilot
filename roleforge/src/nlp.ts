import type { AgentContext, NlpSignals } from "./types.js";

const SKILL_CATALOG = [
  "python",
  "sql",
  "r",
  "react",
  "next.js",
  "typescript",
  "javascript",
  "machine learning",
  "deep learning",
  "llm",
  "nlp",
  "rag",
  "embeddings",
  "vector search",
  "experimentation",
  "a/b testing",
  "forecasting",
  "time series",
  "optimization",
  "pricing",
  "recommendation systems",
  "reinforcement learning",
  "bandits",
  "data engineering",
  "gcp",
  "aws",
  "docker",
  "kubernetes",
  "scikit-learn",
  "pandas"
];

const ROLE_THEMES = [
  "pricing",
  "optimization",
  "forecasting",
  "recommendation",
  "experimentation",
  "real-time systems",
  "stakeholder communication",
  "mentorship",
  "product thinking",
  "ml production",
  "data engineering"
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSkill(normalized: string, skill: string) {
  if (/^[a-z]$/i.test(skill)) {
    return new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(normalized);
  }

  if (skill.includes("+") || skill.includes(".") || skill.includes("/")) {
    return normalized.includes(skill);
  }

  return new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(normalized);
}

export function detectLanguages(text: string) {
  const normalized = normalize(text);
  const languages: string[] = [];

  if (/\b(deutsch|german)\b/.test(normalized)) languages.push("German");
  if (/\b(englisch|english)\b/.test(normalized)) languages.push("English");
  if (/\b(french|französisch)\b/.test(normalized)) languages.push("French");

  return unique(languages);
}

export function detectSeniority(text: string) {
  const normalized = normalize(text);

  if (/\b(principal|staff|lead)\b/.test(normalized)) return "Lead";
  if (/\b(senior|5\+ years|6\+ years|7\+ years)\b/.test(normalized)) return "Senior";
  if (/\b(2\+ years|3\+ years|mid-level|mid level)\b/.test(normalized)) return "Mid";
  if (/\b(intern|entry|junior|graduate)\b/.test(normalized)) return "Junior";

  return "Unspecified";
}

export function extractSkills(text: string) {
  const normalized = normalize(text);
  return unique(SKILL_CATALOG.filter((skill) => containsSkill(normalized, skill)));
}

export function deriveRoleThemes(text: string) {
  const normalized = normalize(text);
  return unique(ROLE_THEMES.filter((theme) => normalized.includes(theme))).slice(0, 8);
}

export function buildNlpSignals(context: AgentContext): NlpSignals {
  const resumeSkills = extractSkills(context.candidate.resumeText);
  const jobSkills = extractSkills(context.target.jobDescription);
  const overlapSkills = jobSkills.filter((skill) => resumeSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill));
  const detectedLanguages = unique([
    ...detectLanguages(context.candidate.resumeText),
    ...detectLanguages(context.target.jobDescription)
  ]);

  return {
    resumeSkills,
    jobSkills,
    overlapSkills,
    missingSkills,
    detectedLanguages,
    seniorityHint: detectSeniority(context.target.jobDescription),
    roleThemes: deriveRoleThemes(context.target.jobDescription)
  };
}
