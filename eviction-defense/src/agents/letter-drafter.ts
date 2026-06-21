import { callClaude } from "../llm.js";
import type { ParsedNotice, TenantRights, Violation } from "../types.js";

const SYSTEM = `You are a tenant rights attorney drafting a formal response letter to an eviction notice.
Write in a professional legal tone. Be firm but respectful. Cite specific laws.
The letter should protect the tenant's rights and buy them time to seek proper legal counsel.
Always include a request for proof of proper service and all required disclosures.`;

export async function draftDefenseLetter(
  notice: ParsedNotice,
  rights: TenantRights,
  violations: Violation[]
): Promise<{ letter: string; summary: string; actions: string[] }> {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Draft a formal tenant defense letter responding to this eviction notice.

TODAY'S DATE: ${today}

NOTICE DETAILS:
- Type: ${notice.noticeType}
- Landlord: ${notice.landlordName}
- Tenant: ${notice.tenantName}
- Property: ${notice.propertyAddress}
- Reason given: ${notice.reasonForEviction}
- Amount claimed: ${notice.amountOwed ? `$${notice.amountOwed}` : "N/A"}
- Deadline: ${notice.deadlineDays} days

VIOLATIONS FOUND (${violations.length}):
${violations.map((v) => `- [${v.severity.toUpperCase()}] ${v.description} (${v.legalBasis})`).join("\n")}

APPLICABLE ${rights.state.toUpperCase()} LAW:
${JSON.stringify(rights, null, 2)}

Return a JSON object with:
{
  "letter": "The full formal letter text, ready to send",
  "summary": "2-3 sentence plain English summary of the tenant's position",
  "actions": ["List of 3-5 immediate action items for the tenant"]
}`;

  const raw = await callClaude(
    SYSTEM,
    prompt + "\n\nRespond with valid JSON only. No markdown."
  );
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}
