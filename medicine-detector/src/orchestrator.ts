import { extractPackagingInfo } from "./agents/packaging-extractor.js";
import { analyzeVisualAuthenticity } from "./agents/visual-analyzer.js";
import { generateVerdict, buildVerificationGuidance } from "./agents/verdict-agent.js";
import { lookupDrug } from "./services/fda-api.js";
import { checkWHOAlerts } from "./services/who-checker.js";
import { checkGlobalRegistries } from "./services/global-registries.js";
import { buildEncyclopedia } from "./services/medicine-encyclopedia.js";
import type { AnalysisResult } from "./types.js";

const DISCLAIMER =
  "This analysis is powered by AI (Claude Vision) and cross-referenced against the FDA Open API, " +
  "WHO Medical Product Alerts, Health Canada Drug Product Database, and WHO Essential Medicines List. " +
  "It is for informational purposes only and does not replace professional pharmaceutical verification. " +
  "If you suspect a counterfeit medicine, DO NOT USE IT and report it immediately to your national " +
  "medicines regulatory authority (e.g. FDA, MHRA, EMA, NAFDAC, CDSCO, TGA, Health Canada).";

export async function analyzeMedicine(
  imageBuffer: Buffer,
  mimeType: string
): Promise<AnalysisResult> {
  // Step 1: Extract all packaging details from the image
  console.log("[1/3] Extracting packaging information...");
  const packaging = await extractPackagingInfo(imageBuffer, mimeType);
  console.log(`      → Drug: "${packaging.drugName}" | Manufacturer: "${packaging.manufacturer}"`);

  // Step 2: All lookups + visual analysis in parallel (max speed)
  console.log("[2/3] Running parallel analysis (FDA + WHO + registries + encyclopedia + visual)...");
  const [fdaRecord, whoAlert, visualAnalysis] = await Promise.all([
    lookupDrug(packaging.drugName),
    Promise.resolve(checkWHOAlerts(
      packaging.drugName,
      packaging.manufacturer,
      packaging.batchNumber ?? undefined
    )),
    analyzeVisualAuthenticity(imageBuffer, mimeType, packaging.drugName),
  ]);

  console.log(`      → FDA: ${fdaRecord.found ? "✓ found" : "✗ not found"}, Recalls: ${fdaRecord.recalls.length}`);
  console.log(`      → WHO alert match: ${whoAlert ? `⚠ MATCHED (${whoAlert.id})` : "none"}`);
  console.log(`      → Visual quality: ${visualAnalysis.overallQuality} (${visualAnalysis.printQualityScore}/100)`);

  // Global registries (needs FDA result) + encyclopedia run after FDA
  const [globalRegistries, encyclopedia] = await Promise.all([
    checkGlobalRegistries(packaging.drugName, fdaRecord.found),
    buildEncyclopedia(packaging.drugName, fdaRecord),
  ]);

  const registriesFound = globalRegistries.filter((r) => r.found).length;
  console.log(`      → Registries: ${registriesFound}/${globalRegistries.length} found`);
  console.log(`      → WHO Essential: ${encyclopedia.isWHOEssential ? "✓ yes" : "no"}`);

  // Step 3: Generate final verdict
  console.log("[3/3] Generating verdict...");
  const verdict = await generateVerdict(packaging, fdaRecord, whoAlert, visualAnalysis);
  console.log(`      → Verdict: ${verdict.verdict.toUpperCase()} (${verdict.score}/100)`);

  const verificationGuidance = buildVerificationGuidance(packaging, verdict);

  return {
    packaging,
    fdaRecord,
    whoAlertMatch: whoAlert,
    globalRegistries,
    visualAnalysis,
    verdict,
    encyclopedia,
    verificationGuidance,
    disclaimer: DISCLAIMER,
  };
}
