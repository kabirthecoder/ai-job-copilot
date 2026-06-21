import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { TenantRights } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../legal-data");

const STATE_FILES: Record<string, string> = {
  california: "california.json",
  "new york": "new-york.json",
  texas: "texas.json",
};

export function lookupTenantRights(state: string): TenantRights | null {
  const key = state.toLowerCase().trim();
  const filename = STATE_FILES[key];
  if (!filename) return null;

  try {
    const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as TenantRights;
  } catch {
    return null;
  }
}

export function getSupportedStates(): string[] {
  return Object.keys(STATE_FILES).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}
