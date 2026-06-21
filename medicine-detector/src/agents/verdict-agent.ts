import { callClaudeJSON } from "../llm.js";
import type {
  PackagingExtraction, FDADrugRecord, WHOAlert,
  VisualAnalysis, AuthenticityVerdict, RedFlag,
} from "../types.js";

const BASE_SYSTEM = `You are a senior pharmaceutical forensics expert making a final authenticity determination.
You synthesize evidence from visual analysis, database lookups, and WHO alerts.
Your verdicts must be evidence-based, clearly explained, and actionable.
Patient safety is paramount — when in doubt, flag as suspicious.
Write immediateAction and detailedExplanation in plain language a non-expert can understand.`;

export async function generateVerdict(
  packaging: PackagingExtraction,
  fdaRecord: FDADrugRecord,
  whoAlert: WHOAlert | null,
  visual: VisualAnalysis,
  langNote = ""
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

  return callClaudeJSON<AuthenticityVerdict>(BASE_SYSTEM + langNote, prompt);
}

export function buildVerificationGuidance(
  packaging: PackagingExtraction,
  verdict: AuthenticityVerdict,
  authority?: { country: string; authority: string; hotline: string; sms?: string; reportUrl: string | null; notes: string } | null
): string[] {
  const guidance: string[] = [];

  if (packaging.verificationCode) {
    guidance.push(
      `Verification code detected: "${packaging.verificationCode}". SMS this code to your country's medicine verification service (mPedigree: SMS to 1393 in Ghana/Nigeria; Sproxil: SMS to 38353 in many countries).`
    );
  }
  if (packaging.hasQRCode) {
    guidance.push("QR code detected — scan it with your phone camera. Genuine QR codes link to the manufacturer's official website.");
  }
  if (packaging.hasScratchCode) {
    guidance.push("Scratch verification panel found — scratch it and enter the code at the manufacturer's official verification website or send via SMS.");
  }

  if (verdict.score < 60) {
    guidance.push("⛔ DO NOT use this medicine until authenticity is confirmed by a licensed pharmacist or healthcare provider.");
    guidance.push("📦 Keep the packaging and receipt — regulatory authorities will need them as evidence.");
  }

  if (authority) {
    const line = [`📞 Report to ${authority.authority} (${authority.country}): ${authority.hotline}`];
    if (authority.sms) line.push(`· SMS: ${authority.sms}`);
    if (authority.reportUrl) line.push(`· Online: ${authority.reportUrl}`);
    guidance.push(line.join(" "));
    if (authority.notes) guidance.push(`ℹ️ ${authority.notes}`);
  } else {
    guidance.push("📞 Report to your national medicines regulatory authority. Keep the packaging as evidence.");
  }

  if (verdict.fdaStatus === "recalled") {
    guidance.push("🚨 This product matches an FDA recall — stop use immediately and return it to your pharmacist.");
  }

  guidance.push("🛒 Always buy medicines from licensed pharmacies. Avoid informal markets, street vendors, and unverified online sellers.");
  guidance.push("🌍 Check live WHO counterfeit alerts at: who.int/teams/regulation-prequalification/incidents-and-fraudulent-products");

  return guidance;
}
