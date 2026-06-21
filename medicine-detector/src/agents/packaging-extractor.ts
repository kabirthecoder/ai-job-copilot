import { callClaudeWithImage } from "../llm.js";
import type { PackagingExtraction } from "../types.js";

const SYSTEM = `You are a pharmaceutical packaging expert and forensic analyst.
Extract every detail from medicine packaging images with maximum precision.
Pay special attention to batch numbers, registration numbers, manufacturer details, and security features.
Your extraction accuracy directly affects patient safety.`;

type SupportedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function getSupportedMime(mime: string): SupportedMime {
  const allowed: SupportedMime[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(mime as SupportedMime)) return mime as SupportedMime;
  if (mime === "image/jpg") return "image/jpeg";
  throw new Error(`Unsupported image format: ${mime}. Please use JPEG, PNG, or WebP.`);
}

export async function extractPackagingInfo(
  imageBuffer: Buffer,
  mimeType: string
): Promise<PackagingExtraction> {
  const safeMime = getSupportedMime(mimeType);

  return callClaudeWithImage<PackagingExtraction>(
    SYSTEM,
    `Analyze this medicine packaging image and extract ALL information into this exact JSON structure:

{
  "drugName": "Primary drug name as printed",
  "brandName": "Brand/trade name if different from drug name, or null",
  "genericName": "Generic/INN name if visible, or null",
  "manufacturer": "Full manufacturer name and location if visible",
  "batchNumber": "Batch/lot number exactly as printed, or null",
  "expiryDate": "Expiry date exactly as printed, or null",
  "manufactureDate": "Manufacture date if visible, or null",
  "dosageForm": "Tablet/capsule/injection/syrup/etc, or null",
  "strength": "Dosage strength (e.g. 500mg, 10mg/mL), or null",
  "countryOfOrigin": "Country of manufacture if stated, or null",
  "registrationNumber": "Drug registration/approval number if visible, or null",
  "verificationCode": "Any USSD code, scratch code, or verification number visible, or null",
  "barcode": "Barcode or QR code number if readable, or null",
  "storageConditions": "Storage instructions if visible, or null",
  "activeIngredients": ["List all active ingredients mentioned"],
  "allTextExtracted": "Complete verbatim text from ALL parts of the packaging, preserving every word",
  "languagesDetected": ["List all languages present on packaging"],
  "hasHologram": true/false,
  "hasQRCode": true/false,
  "hasScratchCode": true/false
}`,
    imageBuffer,
    safeMime
  );
}
