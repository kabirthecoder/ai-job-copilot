export type EmbeddingProvider = "local" | "ollama" | "openai";

const DEFAULT_DIMENSIONS = 128;
const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text";
const DEFAULT_OPENAI_EMBED_MODEL = "text-embedding-3-small";

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.+#-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hashToken(token: string) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function embedTextLocal(text: string, dimensions = DEFAULT_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);

  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const slot = hash % dimensions;
    vector[slot] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]) {
  const size = Math.min(left.length, right.length);
  let sum = 0;

  for (let index = 0; index < size; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

function getEmbeddingProvider(): EmbeddingProvider {
  return (process.env.ROLEFORGE_EMBEDDING_PROVIDER?.trim() as EmbeddingProvider | undefined) || "local";
}

async function embedWithOllama(texts: string[]) {
  const baseUrl = process.env.ROLEFORGE_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.ROLEFORGE_OLLAMA_EMBEDDING_MODEL?.trim() || DEFAULT_OLLAMA_EMBED_MODEL;

  const embeddings: number[][] = [];

  for (const text of texts) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { embedding?: number[] };
    if (!payload.embedding) {
      throw new Error("Ollama embedding response missing embedding");
    }

    embeddings.push(payload.embedding);
  }

  return embeddings;
}

async function embedWithOpenAI(texts: string[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = process.env.ROLEFORGE_OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.ROLEFORGE_OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBED_MODEL;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for OpenAI embeddings");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: texts
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return (payload.data ?? []).map((item) => item.embedding ?? []);
}

export async function embedTexts(texts: string[]) {
  const provider = getEmbeddingProvider();

  try {
    if (provider === "ollama") {
      return {
        provider,
        embeddings: await embedWithOllama(texts)
      };
    }

    if (provider === "openai") {
      return {
        provider,
        embeddings: await embedWithOpenAI(texts)
      };
    }
  } catch {
    return {
      provider: "local" as const,
      embeddings: texts.map((text) => embedTextLocal(text))
    };
  }

  return {
    provider,
    embeddings: texts.map((text) => embedTextLocal(text))
  };
}
