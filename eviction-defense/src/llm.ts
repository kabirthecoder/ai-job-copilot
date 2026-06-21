import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function callClaudeJSON<T>(systemPrompt: string, userMessage: string): Promise<T> {
  const text = await callClaude(
    systemPrompt + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation — raw JSON.",
    userMessage
  );
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
