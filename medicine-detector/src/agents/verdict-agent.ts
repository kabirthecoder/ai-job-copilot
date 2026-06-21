import { callClaudeJSON } from "../llm.js";
import type {
  PackagingExtraction, FDADrugRecord, WHOAlert,
  VisualAnalysis, AuthenticityVerdict, RedFlag,
} from "../types.js";

const SYSTEM = `You are a senior pharmaceutical forensics expert making a final authenticity determination.
You synthesize evidence from visual analysis, database lookups, and WHO alerts.
Your verdicts must be evidence-based, clearly explained, and actionable.
Patient safety is paramount — when in doubt, flag as suspicious.`;

export async function generateVerdict(
  packaging: PackagingExtraction,
  fdaRecord: FDADrugRecord,
  whoAlert: WHOAlert | null,
  visual: VisualAnalysis
): Promise<AuthenticityVerdict> {
  const prompt = `Synthesize all evidence and generate a final authenticity verdict.

PACKAGING DETAILS:
${JSON.stringify(packaging, null, 2)}

FDA DATABASE RESULT:
${JSON.stringify(fdaRecord, null, 2)}

WHO ALERT MATCH: ${whoAlert ? JSON.stringify(whoAlert, null, 2) : "None found"}

VISUAL ANALYSIS:
${JSON.stringify(visual, null, 2)}

Return this exact JSON:
{
  "score": 0-100 (100 = definitely authentic, 0 = definitely counterfeit),
  "verdict": "authentic" | "likely-authentic" | "suspicious" | "likely-counterfeit" | "counterfeit",
  "confidence": "high" | "medium" | "low",
  "redFlags": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "visual" | "database" | "who-alert" | "recall" | "format" | "text",
      "description": "Specific, actionable description of the red flag"
    }
  ],
  "positiveSignals": ["Things that suggest the product may be authentic"],
  "fdaStatus": "verified" | "recalled" | "not-found" | "unknown",
  "immediateAction": "Single most important thing the person should do RIGHT NOW",
  "detailedExplanation": "2-3 paragraph clear explanation of the verdict for a non-expert reader"
}

Scoring guidelines:
- WHO alert exact batch match → score ≤ 15 (counterfeit)
- FDA recall active → score ≤ 25 (likely-counterfeit)
- Multiple critical visual flaws → score ≤ 40 (suspicious to likely-counterfeit)
- Drug not in FDA database + multiple visual issues → score ≤ 50 (suspicious)
- Clean visual + FDA verified + no alerts → score ≥ 75 (likely-authentic to authentic)`;

  return callClaudeJSON<AuthenticityVerdict>(SYSTEM, prompt);
}

export function buildVerificationGuidance(
  packaging: PackagingExtraction,
  verdict: AuthenticityVerdict
): string[] {
  const guidance: string[] = [];

  if (packaging.verificationCode) {
    guidance.push(
      `Verification code detected: "${packaging.verificationCode}". Text this code to your country's medicine verification service (e.g., mPedigree: SMS to 1393 in Ghana/Nigeria).`
    );
  }

  if (packaging.hasQRCode) {
    guidance.push("QR code detected — scan it with your phone camera. Legitimate QR codes should direct to the manufacturer's official website.");
  }

  if (packaging.hasScratchCode) {
    guidance.push("Scratch verification panel detected — scratch and enter the code on the manufacturer's official verification website or SMS line.");
  }

  if (verdict.score < 60) {
    guidance.push("DO NOT use this medicine until its authenticity is confirmed by a licensed pharmacist or healthcare provider.");
    guidance.push("Report this product to your national medicines regulatory authority (NMRA) immediately.");
    guidance.push("Preserve the packaging and any receipt — regulators will need them.");
  }

  if (verdict.fdaStatus === "recalled") {
    guidance.push("This product matches an FDA recall — stop use immediately and contact your pharmacist for a replacement.");
  }

  guidance.push("Always purchase medicines from licensed pharmacies with verifiable supply chains.");
  guidance.push("Check the WHO Medical Product Alerts database at who.int for the latest counterfeiting warnings.");

  return guidance;
}
