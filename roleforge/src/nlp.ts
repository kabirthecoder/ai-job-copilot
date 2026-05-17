import type { AgentContext, NlpSignals } from "./types.js";

const SKILL_ALIASES: Record<string, string[]> = {
  python: ["python", "python3"],
  sql: ["sql", "postgresql", "mysql", "sqlite"],
  r: [" r ", "r language"],
  react: ["react", "reactjs", "react.js"],
  "next.js": ["next.js", "nextjs"],
  typescript: ["typescript", "ts"],
  javascript: ["javascript", "js", "node.js", "nodejs"],
  "machine learning": ["machine learning", "ml models", "predictive modeling"],
  "deep learning": ["deep learning", "neural network", "neural networks"],
  llm: ["llm", "large language model", "large language models", "generative ai"],
  nlp: ["nlp", "natural language processing"],
  rag: ["rag", "retrieval augmented generation"],
  embeddings: ["embeddings", "semantic similarity"],
  "vector search": ["vector search", "vector database", "vector db"],
  experimentation: ["experimentation", "experiment design", "ab testing", "a/b testing", "split testing"],
  forecasting: ["forecasting", "forecast model", "demand planning"],
  "time series": ["time series", "time-series"],
  optimization: ["optimization", "optimisation", "linear programming"],
  pricing: ["pricing", "dynamic pricing", "yield management", "revenue optimization"],
  "recommendation systems": ["recommendation systems", "recommender systems", "ranking systems"],
  "reinforcement learning": ["reinforcement learning", "rl"],
  bandits: ["bandits", "multi armed bandit", "multi-armed bandit"],
  "data engineering": ["data engineering", "etl", "elt", "data pipelines"],
  gcp: ["gcp", "google cloud"],
  aws: ["aws", "amazon web services"],
  azure: ["azure", "microsoft azure"],
  docker: ["docker", "containerization", "containerisation"],
  kubernetes: ["kubernetes", "k8s"],
  "scikit-learn": ["scikit-learn", "sklearn"],
  pandas: ["pandas"],
  pytorch: ["pytorch"],
  tensorflow: ["tensorflow"],
  rust: ["rust"],
  grpc: ["grpc"],
  rest: ["rest", "rest api", "restful api"]
};

const ROLE_THEME_ALIASES: Record<string, string[]> = {
  pricing: ["pricing", "revenue optimization", "yield management"],
  optimization: ["optimization", "optimisation"],
  forecasting: ["forecasting", "demand planning"],
  recommendation: ["recommendation", "ranking", "recommender"],
  experimentation: ["experimentation", "a/b testing", "ab testing", "split testing"],
  "real-time systems": ["real-time", "low latency", "high throughput", "at scale"],
  "stakeholder communication": ["stakeholder", "cross-functional", "communicate insights", "data storytelling"],
  mentorship: ["mentor", "mentorship", "guide less experienced", "knowledge sharing"],
  "product thinking": ["product", "user experience", "customer impact"],
  "ml production": ["production", "deploy", "monitoring", "iteration", "serve millions"],
  "data engineering": ["data engineering", "pipelines", "etl", "elt"]
};

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
  return unique(
    Object.entries(SKILL_ALIASES)
      .filter(([skill, aliases]) => containsSkill(normalized, skill) || aliases.some((alias) => normalized.includes(alias)))
      .map(([skill]) => skill)
  );
}

export function deriveRoleThemes(text: string) {
  const normalized = normalize(text);
  return unique(
    Object.entries(ROLE_THEME_ALIASES)
      .filter(([theme, aliases]) => normalized.includes(theme) || aliases.some((alias) => normalized.includes(alias)))
      .map(([theme]) => theme)
  ).slice(0, 8);
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
