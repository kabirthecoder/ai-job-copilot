import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callClaude(system: string, user: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  return block.text;
}

export async function callClaudeJSON<T>(system: string, user: string): Promise<T> {
  const text = await callClaude(
    system + "\n\nRespond with valid JSON only — no markdown fences, no explanation.",
    user
  );
  return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()) as T;
}

export async function callClaudeWithImage<T>(
  system: string,
  userText: string,
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<T> {
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: system + "\n\nRespond with valid JSON only — no markdown fences, no explanation.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBuffer.toString("base64") },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });
  const block = res.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  const text = block.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(text) as T;
}
