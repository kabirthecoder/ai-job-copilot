import type { AgentContext, AgentResult, JobAgentOutput } from "../types.js";

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function detectLanguageRequirements(text: string) {
  const hits: string[] = [];
  if (/\b(deutsch|german)\b/i.test(text)) hits.push("German");
  if (/\b(englisch|english)\b/i.test(text)) hits.push("English");
  if (/\b(french|französisch)\b/i.test(text)) hits.push("French");
  return unique(hits);
}

function detectRoleFamily(text: string) {
  if (/\b(data scientist|applied scientist|research scientist)\b/i.test(text)) {
    return "Data / Applied Science";
  }

  if (/\b(ai engineer|ml engineer|machine learning engineer|software engineer)\b/i.test(text)) {
    return "AI / ML Engineering";
  }

  if (/\b(data analyst|analytics engineer|bi engineer)\b/i.test(text)) {
    return "Analytics / Data";
  }

  return "General";
}

function detectSeniority(text: string, role: string) {
  const combined = `${role} ${text}`.toLowerCase();

  if (/\b(principal|staff|lead)\b/.test(combined)) return "Lead";
  if (/\b(senior|5\+ years|6\+ years|7\+ years)\b/.test(combined)) return "Senior";
  if (/\b(mid|mid-level|mid level|2\+ years|3\+ years)\b/.test(combined)) return "Mid";
  if (/\b(graduate|entry|junior|intern)\b/.test(combined)) return "Junior";

  return "Unspecified";
}

function sentenceList(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreJobSkill(skill: string, text: string) {
  const normalized = text.toLowerCase();
  let score = 0;

  if (normalized.includes(skill)) score += 2;
  if (new RegExp(`(required|must have|strong|proficien|expert|experience).{0,40}${skill}`, "i").test(text)) score += 3;
  if (new RegExp(`${skill}.{0,40}(required|must have|strong|proficien|expert|experience)`, "i").test(text)) score += 2;
  if (new RegExp(`responsibilit|build|deploy|work across|ownership`, "i").test(text) && normalized.includes(skill)) score += 1;

  return score;
}

function deriveMustHaves(jobDescription: string, jobSkills: string[]) {
  return jobSkills
    .map((skill) => ({ skill, score: scoreJobSkill(skill, jobDescription) }))
    .filter((entry) => entry.score >= 2)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.skill)
    .slice(0, 8);
}

function deriveNiceToHaves(jobDescription: string, jobSkills: string[], mustHaves: string[]) {
  const preferredZone = sentenceList(jobDescription)
    .filter((sentence) => /\b(preferred|bonus|nice to have|valued|plus)\b/i.test(sentence))
    .join(" ")
    .toLowerCase();

  return unique(
    jobSkills.filter((skill) => !mustHaves.includes(skill) && preferredZone.includes(skill))
  ).slice(0, 6);
}

function deriveBusinessNeeds(context: AgentContext) {
  const text = context.target.jobDescription.toLowerCase();
  const roleThemes = context.nlp?.roleThemes ?? [];
  const needs = [...roleThemes];

  if (/\bstakeholder|cross-functional|communicat/i.test(text)) needs.push("stakeholder communication");
  if (/\bproduct\b|user experience|customer/i.test(text)) needs.push("product thinking");
  if (/\bproduction\b|deploy|scale|maintain/i.test(text)) needs.push("ml production");
  if (/\bmentor|guide|knowledge sharing/i.test(text)) needs.push("mentorship");

  return unique(needs).slice(0, 6);
}

function deriveSuccessSignals(jobDescription: string) {
  const normalized = jobDescription.toLowerCase();
  const signals: string[] = [];

  if (/\bproduction\b|deploy|operate|maintain/i.test(normalized)) signals.push("production ownership");
  if (/\bproduct teams|stakeholder|cross-functional/i.test(normalized)) signals.push("cross-functional impact");
  if (/\bmillions|scale|impact|business performance|measurable/i.test(normalized)) signals.push("measurable outcomes");
  if (/\breasoning|first principles|problem solving/i.test(normalized)) signals.push("strong reasoning");

  return unique(signals);
}

export async function runJobAgent(context: AgentContext): Promise<AgentResult<JobAgentOutput>> {
  const jobDescription = context.target.jobDescription;
  const role = context.target.targetRole || "";
  const jobSkills = context.nlp?.jobSkills ?? [];
  const mustHaves = deriveMustHaves(jobDescription, jobSkills);
  const niceToHaves = deriveNiceToHaves(jobDescription, jobSkills, mustHaves);

  const output: JobAgentOutput = {
    seniority: detectSeniority(jobDescription, role),
    roleFamily: detectRoleFamily(`${role} ${jobDescription}`),
    mustHaves: mustHaves.length ? mustHaves : jobSkills.slice(0, 6),
    niceToHaves,
    languageRequirements: context.nlp?.detectedLanguages.length
      ? context.nlp.detectedLanguages
      : detectLanguageRequirements(jobDescription),
    businessNeeds: deriveBusinessNeeds(context),
    successSignals: deriveSuccessSignals(jobDescription)
  };

  return {
    agent: "job-agent",
    mode: "deterministic",
    model: "nlp-parser",
    usedFallback: false,
    output,
    notes: ["Job Agent used deterministic parsing and NLP signals to extract role requirements, seniority, and business needs."]
  };
}
