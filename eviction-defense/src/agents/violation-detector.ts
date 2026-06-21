import { callClaudeJSON } from "../llm.js";
import type { ParsedNotice, TenantRights, Violation } from "../types.js";

const SYSTEM = `You are a tenant rights attorney analyzing eviction notices for legal violations.
Your job is to find every procedural error, missing disclosure, insufficient notice period,
or potentially illegal eviction reason. Be thorough — tenants deserve to know all their rights.
Only flag genuine violations based on the provided law data, not speculation.`;

export async function detectViolations(
  notice: ParsedNotice,
  rights: TenantRights
): Promise<Violation[]> {
  const prompt = `Analyze this eviction notice for legal violations based on ${rights.state} tenant law.

PARSED NOTICE:
${JSON.stringify(notice, null, 2)}

${rights.state.toUpperCase()} TENANT RIGHTS:
${JSON.stringify(rights, null, 2)}

Return a JSON array of violations. Each violation must have:
{
  "type": "notice-period" | "missing-disclosure" | "illegal-reason" | "retaliation" | "procedural",
  "description": "Clear explanation of the violation",
  "legalBasis": "Specific law or code section",
  "severity": "high" | "medium" | "low"
}

Return [] if no violations found. Return only the JSON array.`;

  return callClaudeJSON<Violation[]>(SYSTEM, prompt);
}
