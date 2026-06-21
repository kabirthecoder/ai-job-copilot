import { callClaudeJSON } from "../llm.js";
import type { ParsedNotice } from "../types.js";

const SYSTEM = `You are a legal document analyst specializing in eviction notices.
Extract structured information from eviction notices accurately.
If a field is not present in the notice, use reasonable defaults or mark as unknown.
For state, infer from address or context clues. If unclear, use "unknown".
For deadlineDays, extract the number of days given to respond (e.g., 3-day notice = 3).`;

export async function parseNotice(noticeText: string): Promise<ParsedNotice> {
  const result = await callClaudeJSON<Omit<ParsedNotice, "rawText">>(
    SYSTEM,
    `Parse this eviction notice and return a JSON object with these exact fields:
{
  "noticeType": "pay-or-quit" | "cure-or-quit" | "unconditional-quit" | "no-fault" | "unknown",
  "landlordName": "string",
  "tenantName": "string",
  "propertyAddress": "string",
  "state": "string (full state name, e.g. California)",
  "amountOwed": number or null,
  "deadlineDays": number,
  "deadlineDate": "string or null",
  "reasonForEviction": "string",
  "servingMethod": "string or null"
}

EVICTION NOTICE:
${noticeText}`
  );

  return { ...result, rawText: noticeText };
}
