import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import NodeCache from "node-cache";
import type { RegistryResult } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = new NodeCache({ stdTTL: 3600 });

const essentialData = JSON.parse(
  readFileSync(join(__dirname, "../data/who-essential-medicines.json"), "utf-8")
) as { medicines: Array<{ names: string[]; category: string; sinceYear: number }> };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function isInEssentialList(drugName: string): { found: boolean; category?: string; since?: number } {
  const norm = normalize(drugName);
  for (const med of essentialData.medicines) {
    for (const n of med.names) {
      if (norm.includes(n) || n.includes(norm) || norm === n) {
        return { found: true, category: med.category, since: med.sinceYear };
      }
    }
  }
  return { found: false };
}

// --- Health Canada Drug Product Database ---
interface HCResult {
  brand_name?: string;
  drug_identification_num?: string;
  class?: string;
  number_of_ais?: string;
}

async function checkHealthCanada(drugName: string): Promise<RegistryResult> {
  const cacheKey = `hc:${drugName}`;
  const cached = cache.get<RegistryResult>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&brand_name=${encodeURIComponent(drugName.toUpperCase())}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as HCResult[];
      const found = Array.isArray(data) && data.length > 0;
      const result: RegistryResult = {
        name: "Health Canada (DPD)",
        region: "Canada",
        flag: "🇨🇦",
        found,
        status: found ? "Registered" : "Not found in Canadian database",
        details: found
          ? `DIN: ${data[0]?.drug_identification_num ?? "N/A"} — ${data[0]?.class ?? "Pharmaceutical"}`
          : undefined,
      };
      cache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Health Canada API failure — degrade gracefully
  }

  // Fallback: try active ingredient search
  try {
    const res = await fetch(
      `https://health-products.canada.ca/api/drug/activeingredient/?lang=en&type=json&ingredient_name=${encodeURIComponent(drugName)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{ ingredient_name?: string }>;
      const found = Array.isArray(data) && data.length > 0;
      const result: RegistryResult = {
        name: "Health Canada (DPD)",
        region: "Canada",
        flag: "🇨🇦",
        found,
        status: found ? "Active ingredient registered" : "Not found",
      };
      cache.set(cacheKey, result);
      return result;
    }
  } catch {
    // ignore
  }

  const result: RegistryResult = {
    name: "Health Canada (DPD)",
    region: "Canada",
    flag: "🇨🇦",
    found: false,
    status: "Registry unavailable",
  };
  cache.set(cacheKey, result);
  return result;
}

// --- WHO Essential Medicines ---
function checkWHOEssential(drugName: string): RegistryResult {
  const match = isInEssentialList(drugName);
  return {
    name: "WHO Essential Medicines List",
    region: "Global",
    flag: "🌍",
    found: match.found,
    status: match.found
      ? `Essential medicine — ${match.category} (since ${match.since})`
      : "Not on WHO Essential Medicines List",
    details: match.found
      ? "Included in WHO Model List of Essential Medicines, 23rd Edition (2023)"
      : undefined,
  };
}

// --- WHO Prequalification Programme ---
// Curated high-confidence list of prequalified drug categories
const PREQUALIFIED_CATEGORIES = [
  "antiretroviral", "hiv", "anti-hiv",
  "artemether", "lumefantrine", "artesunate", "antimalarial",
  "rifampicin", "isoniazid", "ethambutol", "pyrazinamide", "tuberculosis", "tb",
  "amoxicillin", "cotrimoxazole", "ciprofloxacin",
  "oxytocin", "misoprostol",
  "insulin",
  "metformin",
  "oral rehydration",
];

function checkWHOPrequalification(drugName: string): RegistryResult {
  const norm = normalize(drugName);
  const qualified = PREQUALIFIED_CATEGORIES.some(
    (cat) => norm.includes(cat) || cat.includes(norm)
  );
  return {
    name: "WHO Prequalification Programme",
    region: "Global (developing countries)",
    flag: "🏥",
    found: qualified,
    status: qualified
      ? "Drug class eligible for WHO prequalification"
      : "Not in prequalified categories",
    details: qualified
      ? "WHO PQ verifies quality, safety & efficacy for procurement in developing countries"
      : undefined,
  };
}

export async function checkGlobalRegistries(
  drugName: string,
  fdaFound: boolean
): Promise<RegistryResult[]> {
  const [healthCanada, whoEssential, whoPrequal] = await Promise.all([
    checkHealthCanada(drugName),
    Promise.resolve(checkWHOEssential(drugName)),
    Promise.resolve(checkWHOPrequalification(drugName)),
  ]);

  const fdaResult: RegistryResult = {
    name: "FDA (OpenFDA)",
    region: "United States",
    flag: "🇺🇸",
    found: fdaFound,
    status: fdaFound ? "Drug found in FDA database" : "Not found in FDA database",
  };

  return [fdaResult, healthCanada, whoEssential, whoPrequal];
}
