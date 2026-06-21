import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { WHOAlert } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const alerts: WHOAlert[] = JSON.parse(
  readFileSync(join(__dirname, "../data/who-alerts.json"), "utf-8")
) as WHOAlert[];

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokA = new Set(normalize(a).split(" ").filter((t) => t.length > 2));
  const tokB = new Set(normalize(b).split(" ").filter((t) => t.length > 2));
  let matches = 0;
  tokA.forEach((t) => { if (tokB.has(t)) matches++; });
  return matches / Math.max(tokA.size, 1);
}

export function checkWHOAlerts(
  drugName: string,
  manufacturer: string,
  batchNumber?: string
): WHOAlert | null {
  let bestMatch: WHOAlert | null = null;
  let bestScore = 0;

  for (const alert of alerts) {
    let score = 0;

    // Batch number is a definitive match
    if (batchNumber) {
      const batchNorm = normalize(batchNumber);
      for (const alertBatch of alert.batchNumbers) {
        if (normalize(alertBatch) === batchNorm) {
          return alert; // exact batch match → return immediately
        }
      }
    }

    // Score by product name overlap
    const nameScore = tokenOverlap(drugName, alert.productName);
    score += nameScore * 60;

    // Score by manufacturer overlap
    const mfgScore = tokenOverlap(manufacturer, alert.manufacturer);
    score += mfgScore * 40;

    if (score > bestScore && score >= 40) {
      bestScore = score;
      bestMatch = alert;
    }
  }

  return bestMatch;
}

export function getAlertsByCountry(country: string): WHOAlert[] {
  const norm = normalize(country);
  return alerts.filter((a) =>
    a.countries.some((c) => normalize(c).includes(norm))
  );
}
