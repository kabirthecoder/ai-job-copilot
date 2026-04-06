const agents = [
  {
    name: "resume-agent",
    purpose: "Extract identity, skills, and evidence lines from resume text",
    llm: true,
    fallback: true
  },
  {
    name: "job-agent",
    purpose: "Parse seniority, role family, must-haves, and language requirements",
    llm: true,
    fallback: true
  },
  {
    name: "research-agent",
    purpose: "Summarize company context and research signals",
    llm: true,
    fallback: true
  },
  {
    name: "gap-agent",
    purpose: "Compare resume and JD outputs into strengths, gaps, and focus areas",
    llm: true,
    fallback: true
  },
  {
    name: "rewrite-agent",
    purpose: "Rewrite resume bullets for the target role",
    llm: true,
    fallback: true
  },
  {
    name: "cover-letter-agent",
    purpose: "Draft a role-specific cover letter",
    llm: true,
    fallback: true
  },
  {
    name: "review-agent",
    purpose: "Review the cover letter for generic or weak output",
    llm: true,
    fallback: true
  }
];

function toEnvPrefix(agentName) {
  return agentName.replace(/-/g, "_").toUpperCase();
}

function resolveAgentEnv(agentName) {
  const prefix = `ROLEFORGE_${toEnvPrefix(agentName)}`;
  const provider =
    process.env[`${prefix}_PROVIDER`]?.trim() ||
    process.env.ROLEFORGE_PROVIDER?.trim() ||
    "ollama";

  const model =
    provider === "openai"
      ? process.env[`${prefix}_MODEL`]?.trim() ||
        process.env.ROLEFORGE_OPENAI_MODEL?.trim() ||
        "gpt-5.4-mini"
      : provider === "mock"
        ? "mock"
        : process.env[`${prefix}_MODEL`]?.trim() ||
          process.env.ROLEFORGE_OLLAMA_MODEL?.trim() ||
          "llama3.2:3b";

  const baseUrl =
    provider === "openai"
      ? process.env[`${prefix}_BASE_URL`]?.trim() ||
        process.env.ROLEFORGE_OPENAI_BASE_URL?.trim() ||
        "https://api.openai.com/v1"
      : provider === "mock"
        ? "-"
        : process.env[`${prefix}_BASE_URL`]?.trim() ||
          process.env.ROLEFORGE_OLLAMA_BASE_URL?.trim() ||
          "http://127.0.0.1:11434";

  return { provider, model, baseUrl };
}

console.log("RoleForge Agent Check");
console.log("=====================");
console.log("Per-agent model assignments are supported.");
console.log("");

for (const agent of agents) {
  const env = resolveAgentEnv(agent.name);
  console.log(`${agent.name}`);
  console.log(`  Purpose  : ${agent.purpose}`);
  console.log(`  Uses LLM : ${agent.llm ? "yes" : "no"}`);
  console.log(`  Fallback : ${agent.fallback ? "yes" : "no"}`);
  console.log(`  Provider : ${env.provider}`);
  console.log(`  Model    : ${env.model}`);
  console.log(`  Base URL : ${env.baseUrl}`);
}
