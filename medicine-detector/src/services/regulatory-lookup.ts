import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Authority {
  country: string;
  code: string;
  flag: string;
  authority: string;
  fullName: string;
  hotline: string;
  sms?: string;
  website: string;
  reportUrl: string | null;
  languages: string[];
  notes: string;
}

const db = JSON.parse(
  readFileSync(join(__dirname, "../data/regulatory-authorities.json"), "utf-8")
) as { authorities: Authority[] };

const byCode = new Map<string, Authority>(
  db.authorities.map((a) => [a.code.toLowerCase(), a])
);

const byCountryName = new Map<string, Authority>();
for (const a of db.authorities) {
  byCountryName.set(a.country.toLowerCase(), a);
}

/** Look up by ISO country code (2-letter) or country name */
export function getAuthority(countryOrCode: string): Authority | null {
  const norm = countryOrCode.toLowerCase().trim();
  return byCode.get(norm) ?? byCountryName.get(norm) ?? null;
}

/** Get all authorities whose language list includes the given language */
export function getAuthoritiesByLanguage(language: string): Authority[] {
  const norm = language.toLowerCase();
  return db.authorities.filter((a) =>
    a.languages.some((l) => l.toLowerCase().includes(norm))
  );
}

/** Infer likely country from packaging languages and country-of-origin field */
export function inferCountry(
  countryOfOrigin: string | undefined,
  languagesDetected: string[]
): Authority | null {
  if (countryOfOrigin) {
    const result = getAuthority(countryOfOrigin);
    if (result) return result;
  }
  // Fallback: match by primary packaging language
  for (const lang of languagesDetected) {
    const matches = getAuthoritiesByLanguage(lang);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

export { Authority };
