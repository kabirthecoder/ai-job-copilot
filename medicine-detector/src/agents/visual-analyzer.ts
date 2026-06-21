import { callClaudeWithImage } from "../llm.js";
import { getSupportedMime } from "./packaging-extractor.js";
import type { VisualAnalysis } from "../types.js";

const SYSTEM = `You are a pharmaceutical forensics expert specializing in detecting counterfeit medicines.
You have inspected thousands of genuine and counterfeit drug packages.
Analyze packaging images for every visual authenticity marker with forensic precision.
Your analysis protects patient lives — be thorough and accurate.`;

export async function analyzeVisualAuthenticity(
  imageBuffer: Buffer,
  mimeType: string,
  drugName: string
): Promise<VisualAnalysis> {
  const safeMime = getSupportedMime(mimeType);

  return callClaudeWithImage<VisualAnalysis>(
    SYSTEM,
    `Perform a detailed visual authenticity analysis of this ${drugName} packaging.

Examine every visible aspect and return this exact JSON:
{
  "overallQuality": "high" | "medium" | "low" | "very-low",
  "printQualityScore": 0-100,
  "spellingErrors": ["List any spelling/grammar errors found verbatim"],
  "fontInconsistencies": ["Describe any font size, style, or spacing inconsistencies"],
  "colorAnomalies": ["Describe color printing issues, fading, or inconsistencies"],
  "packagingDefects": ["Physical defects: misaligned text, crooked labels, poor cuts"],
  "suspiciousElements": ["Anything that seems wrong, unusual, or inconsistent with pharmaceutical standards"],
  "authenticElements": ["Security features present: holograms, embossing, serial numbers, tamper evidence"],
  "batchNumberFormatValid": true/false (pharmaceutical batch numbers are typically alphanumeric, 6-12 chars),
  "expiryFormatValid": true/false (standard formats: MM/YYYY, MM-YYYY, EXP MM/YYYY)
}

Key fraud indicators to look for:
- Blurry, pixelated, or inconsistent printing
- Spelling mistakes in drug names or ingredients
- Wrong or missing regulatory symbols (CE, FDA, country-specific marks)
- Inconsistent fonts within the same label
- Missing or poorly replicated holograms
- Batch numbers that are too simple (e.g., all zeros, sequential simple numbers)
- Unusually short expiry periods or already-expired dates
- Missing mandatory information (manufacturer address, registration number)
- Text that appears copy-pasted or digitally altered
- Color saturation issues (too bright, too faded, wrong hue)`,
    imageBuffer,
    safeMime
  );
}
