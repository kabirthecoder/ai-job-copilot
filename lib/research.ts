import type { AnalysisInput, CompanyResearch } from "@/lib/types";

const MAX_TEXT_LENGTH = 12000;
const NOISE_PATTERNS = [
  /cookie/i,
  /privacy/i,
  /terms/i,
  /consent/i,
  /linkedin/i,
  /sign in/i,
  /log in/i,
  /advertis/i,
  /preferences/i
];

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\s\|\s|•|\u2022|\s-\s(?=[A-ZÄÖÜ])/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence.length > 40 &&
        sentence.length < 240 &&
        !NOISE_PATTERNS.some((pattern) => pattern.test(sentence))
    );
}

function extractAchievementSignals(text: string) {
  const keywords = [
    "launched",
    "announced",
    "expanded",
    "grew",
    "improved",
    "introduced",
    "built",
    "released",
    "partner",
    "award",
    "recognized",
    "innovation",
    "growth"
  ];

  return unique(
    splitSentences(text).filter((sentence) =>
      keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
    )
  )
    .filter((sentence) => !/about the job|deine benefits|dein profil/i.test(sentence))
    .slice(0, 3);
}

function extractHiringSignals(jobDescription: string) {
  const sentences = splitSentences(jobDescription);
  const keywords = [
    "production",
    "experiment",
    "stakeholder",
    "mentorship",
    "pricing",
    "forecasting",
    "optimization",
    "real-time",
    "business"
  ];

  return unique(
    sentences.filter((sentence) =>
      keywords.some((keyword) => sentence.toLowerCase().includes(keyword))
    )
  )
    .map((sentence) => sentence.slice(0, 180).trim())
    .slice(0, 3);
}

function buildCandidateUrls(input: AnalysisInput) {
  const urls: string[] = [];
  const website = input.companyWebsite?.trim();
  const companyName = input.companyName?.trim();

  if (website) {
    try {
      const normalized = website.startsWith("http") ? website : `https://${website}`;
      const url = new URL(normalized);
      if (!/linkedin\.com/i.test(url.hostname)) {
        urls.push(url.toString());
        urls.push(new URL("/about", url).toString());
        urls.push(new URL("/careers", url).toString());
        urls.push(new URL("/news", url).toString());
      }
    } catch {
      // Ignore malformed user-provided URLs.
    }
  }

  if (companyName) {
    const slug = toSlug(companyName).replace(/-/g, "");
    urls.push(`https://www.${slug}.com`);
    urls.push(`https://${slug}.com`);
  }

  return unique(urls);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 AI-Research-Job-Copilot"
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(4000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  const html = await response.text();
  return stripHtml(html).slice(0, MAX_TEXT_LENGTH);
}

export async function researchCompany(input: AnalysisInput): Promise<CompanyResearch> {
  if (!input.enableCompanyResearch) {
    return {
      status: "not_requested",
      companySummary: "",
      roleSummary: "",
      latestAchievements: [],
      hiringSignals: [],
      sourceUrls: []
    };
  }

  const urls = buildCandidateUrls(input);
  const fetched: Array<{ url: string; text: string }> = [];

  for (const url of urls.slice(0, 2)) {
    try {
      const text = await fetchText(url);
      if (text.length > 100) {
        fetched.push({ url, text });
      }
    } catch {
      // Ignore unreachable sources and continue.
    }
  }

  if (!fetched.length) {
    return {
      status: "failed",
      companySummary:
        "Public company pages could not be fetched from the provided link. This usually happens with JavaScript-heavy sites, job-board links, or pages that block automated requests.",
      roleSummary: "",
      latestAchievements: [],
      hiringSignals: extractHiringSignals(input.jobDescription),
      sourceUrls: []
    };
  }

  const mergedText = fetched.map((entry) => entry.text).join(" ");
  const companySummary =
    splitSentences(mergedText)[0] ??
    `${input.companyName ?? "The company"} is being researched from public website content.`;

  const roleSummary =
    splitSentences(input.jobDescription).find((sentence) =>
      /build|design|optimiz|experimentation|product|stakeholder|production/i.test(sentence)
    ) ?? "";

  const latestAchievements = extractAchievementSignals(mergedText);
  const hiringSignals = extractHiringSignals(input.jobDescription);

  return {
    status: latestAchievements.length || companySummary ? "researched" : "partial",
    companySummary,
    roleSummary,
    latestAchievements,
    hiringSignals,
    sourceUrls: fetched.map((entry) => entry.url)
  };
}
