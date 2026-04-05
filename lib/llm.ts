import {
  buildEnhancementPrompt,
  buildFallbackEnhancements,
  type CopilotAnalysisInput,
  type CopilotEnhancementOutput,
  type CopilotPromptBundle
} from "@/lib/prompts";

export type LLMProvider = "ollama" | "openai" | "mock";

export type LLMEnv = {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl: string;
  model: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

export type AnalysisRequest = CopilotAnalysisInput & {
  forceMock?: boolean;
};

export type EnhancementResponse = CopilotEnhancementOutput & {
  provider: LLMProvider;
  model: string;
  prompt: CopilotPromptBundle;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2:1b";

export function getLLMEnv(): LLMEnv {
  return {
    provider: (process.env.LLM_PROVIDER?.trim() as LLMProvider | undefined) || "mock",
    apiKey: process.env.OPENAI_API_KEY?.trim(),
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
    ollamaModel: process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL
  };
}

function hasJSONContent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function extractJSONObject(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return raw;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseModelJSON(raw: string): CopilotEnhancementOutput | null {
  try {
    const parsed = JSON.parse(extractJSONObject(raw)) as Partial<CopilotEnhancementOutput>;

    if (
      typeof parsed.summary === "string" &&
      Array.isArray(parsed.suggestedProjects) &&
      Array.isArray(parsed.interviewQuestions) &&
      Array.isArray(parsed.nextSteps) &&
      Array.isArray(parsed.recruiterTips) &&
      typeof parsed.coverLetterSnippet === "string" &&
      typeof parsed.coldEmailSnippet === "string" &&
      typeof parsed.portfolioPitch === "string"
    ) {
      return {
        summary: parsed.summary,
        suggestedProjects: parseStringArray(parsed.suggestedProjects),
        interviewQuestions: parseStringArray(parsed.interviewQuestions),
        nextSteps: parseStringArray(parsed.nextSteps),
        recruiterTips: parseStringArray(parsed.recruiterTips),
        coverLetterSnippet: parsed.coverLetterSnippet,
        coldEmailSnippet: parsed.coldEmailSnippet,
        portfolioPitch: parsed.portfolioPitch
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function callOpenAI(
  prompt: CopilotPromptBundle,
  env: LLMEnv
): Promise<CopilotEnhancementOutput | null> {
  if (!env.apiKey) {
    return null;
  }

  const response = await fetch(`${env.baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: prompt.system }] },
        { role: "user", content: [{ type: "input_text", text: prompt.user }] }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && hasJSONContent(item.text))
    ?.text;

  return text ? parseModelJSON(text) : null;
}

async function callOllama(
  prompt: CopilotPromptBundle,
  env: LLMEnv
): Promise<CopilotEnhancementOutput | null> {
  const response = await fetch(`${env.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.ollamaModel,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    message?: {
      content?: string;
    };
  };

  const content = payload.message?.content;
  return content ? parseModelJSON(content) : null;
}

export async function generateCopilotEnhancements(
  request: AnalysisRequest
): Promise<EnhancementResponse> {
  const env = getLLMEnv();
  const prompt = buildEnhancementPrompt(request);

  if (!request.forceMock && env.provider === "ollama") {
    const local = await callOllama(prompt, env);

    if (local) {
      return {
        ...local,
        provider: "ollama",
        model: env.ollamaModel,
        prompt
      };
    }
  }

  if (!request.forceMock && env.provider === "openai" && env.apiKey) {
    const live = await callOpenAI(prompt, env);

    if (live) {
      return {
        ...live,
        provider: "openai",
        model: env.model,
        prompt
      };
    }
  }

  const fallback = buildFallbackEnhancements(request);
  return {
    ...fallback,
    provider: "mock",
    model: env.provider === "ollama" ? env.ollamaModel : env.model,
    prompt
  };
}
