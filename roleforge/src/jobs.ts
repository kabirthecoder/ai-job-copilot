import { buildNlpSignals, detectSeniority } from "./nlp.js";
import type { AgentContext, JobLead, JobMatch, JobSearchPreferences } from "./types.js";

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function buildLocationLabel(job: Partial<JobLead>) {
  return [job.city, job.state, job.country].filter(Boolean).join(", ") || "Location not specified";
}

function parseJobBlock(block: string, index: number): JobLead | null {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const fields = new Map<string, string>();
  let descriptionStart = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (!match) {
      descriptionStart = i;
      break;
    }

    const key = match[1].toLowerCase().replace(/\s+/g, " ").trim();
    const value = match[2].trim();

    if (key === "description") {
      descriptionStart = i;
      fields.set("description", value);
      break;
    }

    fields.set(key, value);
  }

  const title = fields.get("title") || fields.get("role") || `Job opportunity ${index + 1}`;
  const companyName = fields.get("company") || fields.get("company name") || "Unknown company";
  const city = fields.get("city") || "";
  const state = fields.get("state") || "";
  const country = fields.get("country") || "";
  const applyUrl = fields.get("apply url") || fields.get("url") || fields.get("link") || "";
  const companyWebsite = fields.get("company website") || fields.get("website") || "";

  const descriptionLines =
    descriptionStart >= 0
      ? [
          fields.get("description") || "",
          ...lines.slice(descriptionStart + 1)
        ].filter(Boolean)
      : [];

  const description = descriptionLines.join("\n").trim();

  if (!description) {
    return null;
  }

  const idBase = `${companyName}-${title}-${city}-${state}-${country}-${index}`;

  return {
    id: slug(idBase) || `job-${index + 1}`,
    title,
    companyName,
    city,
    state,
    country,
    locationLabel: buildLocationLabel({ city, state, country }),
    applyUrl,
    companyWebsite,
    description,
    source: "manual"
  };
}

export function parseJobFeed(rawFeed: string) {
  return rawFeed
    .split(/\n\s*---+\s*\n/g)
    .map((block, index) => parseJobBlock(block.trim(), index))
    .filter((job): job is JobLead => Boolean(job));
}

function locationMatches(preferences: JobSearchPreferences | undefined, job: JobLead) {
  if (!preferences) {
    return true;
  }

  const city = normalize(preferences.city);
  const state = normalize(preferences.state);
  const country = normalize(preferences.country);

  if (city && normalize(job.city) !== city) {
    return false;
  }

  if (state && normalize(job.state) !== state) {
    return false;
  }

  if (country && normalize(job.country) !== country) {
    return false;
  }

  return true;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function rankJobsForCandidate(context: AgentContext, jobs: JobLead[]): JobMatch[] {
  const resumeSignals = buildNlpSignals({
    ...context,
    target: {
      ...context.target,
      jobDescription: context.candidate.resumeText
    }
  });

  return jobs
    .filter((job) => locationMatches(context.preferences, job))
    .map((job) => {
      const signals = buildNlpSignals({
        candidate: context.candidate,
        target: {
          targetRole: job.title,
          companyName: job.companyName,
          companyWebsite: job.companyWebsite,
          jobDescription: job.description
        }
      });

      const matchedSkills = signals.overlapSkills;
      const missingSkills = signals.missingSkills;
      const locationBoost = context.preferences && [context.preferences.city, context.preferences.state, context.preferences.country].some(Boolean) ? 8 : 0;
      const overlapScore = matchedSkills.length * 11;
      const missingPenalty = missingSkills.length * 4;
      const seniorityFit = detectSeniority(job.description);
      const seniorityBoost = seniorityFit === "Unspecified" || seniorityFit === "Mid" || seniorityFit === "Senior" ? 6 : 0;
      const themeBoost = signals.roleThemes.filter((theme) => resumeSignals.roleThemes.includes(theme)).length * 5;
      const score = clampScore(35 + overlapScore + themeBoost + locationBoost + seniorityBoost - missingPenalty);

      const reasons = [
        matchedSkills.length ? `Strong overlap in ${matchedSkills.slice(0, 4).join(", ")}` : "Role needs deeper skill alignment",
        missingSkills.length ? `Main gaps: ${missingSkills.slice(0, 3).join(", ")}` : "Few obvious gaps from the posting",
        job.locationLabel !== "Location not specified" ? `Location: ${job.locationLabel}` : "Location details were limited"
      ];

      return {
        id: job.id,
        job,
        score,
        reasons,
        matchedSkills,
        missingSkills,
        seniorityFit
      };
    })
    .sort((left, right) => right.score - left.score);
}
