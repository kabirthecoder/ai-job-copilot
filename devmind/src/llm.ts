import 'dotenv/config';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const MODEL = process.env.DEVMIND_MODEL ?? 'gemini-2.5-flash';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(messages: Message[], opts: { json?: boolean } = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required. Copy .env.example to .env and add your key.');

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${GEMINI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required.');

  const res = await fetch(`${GEMINI_BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gemini-embedding-001', input: text }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding error ${res.status}: ${text}`);
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}
