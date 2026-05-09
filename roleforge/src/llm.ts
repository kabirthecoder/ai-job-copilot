export type RoleForgeProvider = "ollama" | "openai" | "mock";

import type { RoleForgeAgentName } from "./types.js";

export type RoleForgeLLMEnv = {
  provider: RoleForgeProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
};

type GenerationOptions = {
  temperature?: number;
  topP?: number;
};

function resolveTimeoutMs() {
  const raw = Number(process.env.ROLEFORGE_AGENT_TIMEOUT_MS || "20000");
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b";

function toEnvPrefix(agentName: RoleForgeAgentName) {
  return agentName.replace(/-/g, "_").toUpperCase();
}

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function getGenerationOptions(agentName: RoleForgeAgentName): GenerationOptions {
  if (agentName === "cover-letter-agent" || agentName === "cover-letter-humanizer-agent") {
    return { temperature: 0.95, topP: 0.92 };
  }

  if (agentName === "review-agent") {
    return { temperature: 0.35, topP: 0.9 };
  }

  return { temperature: 0.2, topP: 0.9 };
}

export function getRoleForgeEnv(agentName: RoleForgeAgentName): RoleForgeLLMEnv {
  const agentPrefix = `ROLEFORGE_${toEnvPrefix(agentName)}`;
  const provider =
    (readEnv(`${agentPrefix}_PROVIDER`) as RoleForgeProvider | undefined) ||
    (readEnv("ROLEFORGE_PROVIDER") as RoleForgeProvider | undefined) ||
    "ollama";

  if (provider === "openai") {
    return {
      provider,
      model:
        readEnv(`${agentPrefix}_MODEL`) ||
        readEnv("ROLEFORGE_OPENAI_MODEL") ||
        DEFAULT_OPENAI_MODEL,
      baseUrl:
        readEnv(`${agentPrefix}_BASE_URL`) ||
        readEnv("ROLEFORGE_OPENAI_BASE_URL") ||
        DEFAULT_OPENAI_BASE_URL,
      apiKey: readEnv("OPENAI_API_KEY"),
      timeoutMs: resolveTimeoutMs()
    };
  }

  if (provider === "mock") {
    return {
      provider,
      model: "mock",
      baseUrl: "",
      timeoutMs: 1000
    };
  }

  return {
    provider: "ollama",
    model:
      readEnv(`${agentPrefix}_MODEL`) ||
      readEnv("ROLEFORGE_OLLAMA_MODEL") ||
      DEFAULT_OLLAMA_MODEL,
    baseUrl:
      readEnv(`${agentPrefix}_BASE_URL`) ||
      readEnv("ROLEFORGE_OLLAMA_BASE_URL") ||
      DEFAULT_OLLAMA_BASE_URL,
    timeoutMs: resolveTimeoutMs()
  };
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

async function callOpenAI<T>(
  env: RoleForgeLLMEnv,
  agentName: RoleForgeAgentName,
  system: string,
  user: string
): Promise<T | null> {
  if (!env.apiKey) {
    return null;
  }

  const response = await fetch(`${env.baseUrl.replace(/\/$/, "")}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(env.timeoutMs),
    body: JSON.stringify({
      model: env.model,
      temperature: getGenerationOptions(agentName).temperature,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && item.text)?.text;

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(extractJSONObject(text)) as T;
  } catch {
    return null;
  }
}

async function callOllama<T>(
  env: RoleForgeLLMEnv,
  agentName: RoleForgeAgentName,
  system: string,
  user: string
): Promise<T | null> {
  let response: Response;

  try {
    response = await fetch(`${env.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(env.timeoutMs),
      body: JSON.stringify({
        model: env.model,
        stream: false,
        format: "json",
        options: {
          temperature: getGenerationOptions(agentName).temperature,
          top_p: getGenerationOptions(agentName).topP
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { message?: { content?: string } };
  const text = payload.message?.content;

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(extractJSONObject(text)) as T;
  } catch {
    return null;
  }
}

export async function invokeRoleForgeAgent<T>(
  agentName: RoleForgeAgentName,
  system: string,
  user: string
): Promise<{ output: T | null; provider: RoleForgeProvider; model: string }> {
  const env = getRoleForgeEnv(agentName);

  if (env.provider === "mock") {
    return { output: null, provider: env.provider, model: env.model };
  }

  const output =
    env.provider === "openai"
      ? await callOpenAI<T>(env, agentName, system, user)
      : await callOllama<T>(env, agentName, system, user);

  return {
    output,
    provider: env.provider,
    model: env.model
  };
}
