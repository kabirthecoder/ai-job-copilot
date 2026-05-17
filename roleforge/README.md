# RoleForge

RoleForge is the advanced version of this project: a secure, multi-user career copilot built around a production-style backend instead of a single prompt. It helps a user upload a CV, parse a job description, understand fit, rewrite the CV for the role, and generate a more human cover letter inside a private workspace.

## What changed in this version

The updated RoleForge build is no longer just a local demo flow. It now includes:

- secure sign-up and sign-in with private sessions
- per-user run ownership and private history
- hidden resume-text handling behind file upload
- deterministic NLP parsing for CV and JD analysis
- retrieval and embeddings for evidence ranking
- deterministic fit scoring instead of fake freeform ATS scoring
- multi-agent writing and review on top of that structured backbone
- rate limiting and basic request hardening

## Current architecture

RoleForge is best described as:

**NLP-first, multi-agent on top**

That means the system now uses deterministic parsing and retrieval for facts, then uses specialized agents for writing and review.

### Layer 1: App and security

- browser UI and API server: `server.mjs`
- account creation and sessions: `src/auth.ts`
- per-user run storage: `src/persistence.ts`

This layer is responsible for:

- sign-up / sign-in
- secure session cookies
- private run history
- request validation
- upload handling

### Layer 2: Parsing and NLP

- CV/JD NLP extraction: `src/nlp.ts`
- deterministic CV parser: `src/agents/resume-agent.ts`
- deterministic JD parser: `src/agents/job-agent.ts`

This layer is responsible for:

- skill extraction
- language detection
- seniority hints
- role-theme extraction
- evidence-line identification
- must-have / nice-to-have parsing

### Layer 3: Retrieval and embeddings

- embeddings provider logic: `src/embeddings.ts`
- retrieval orchestration: `src/retrieval.ts`
- local vector cache: `src/vector-store.ts`

This layer is responsible for:

- chunking CV and JD text
- embedding chunks
- ranking relevant evidence
- feeding the strongest supporting context into downstream steps

### Layer 4: Scoring and analysis

- deterministic gap and fit scoring: `src/agents/gap-agent.ts`

This layer is responsible for:

- strengths
- missing areas
- improvement priorities
- fit score
- expected score after CV changes

### Layer 5: Multi-agent writing

- CV rewrite: `src/agents/rewrite-agent.ts`
- cover letter draft: `src/agents/cover-letter-agent.ts`
- cover letter humanizer: `src/agents/cover-letter-humanizer-agent.ts`
- final review: `src/agents/review-agent.ts`

These are the agents that still depend most on the LLM.

## Current agent split

### Deterministic / NLP-backed agents

- `resume-agent`
- `job-agent`
- `research-agent`
- `gap-agent`

These now run without depending on the LLM to produce the core facts.

### LLM-backed agents

- `rewrite-agent`
- `cover-letter-agent`
- `cover-letter-humanizer-agent`
- `review-agent`

These are used where generation, tone, and rewriting actually matter.

## Why this architecture is better

Earlier versions depended too heavily on the model for everything. That caused:

- unstable parsing
- inflated scores
- too many fallbacks
- generic outputs

The current version fixes that by separating:

- facts
- retrieval
- scoring
- writing

This is much closer to how a production-grade AI product should be structured.

## Backend status right now

### What is working well

- private user accounts and sessions
- user-scoped runs
- file upload and resume extraction
- deterministic CV/JD parsing
- deterministic fit scoring
- retrieval flow and vector caching
- secure route checks

### What is still the weakest part

The writing agents still fall back too often on a local Ollama model.

Current smoke-test result after the backend redesign:

- `failures: 0`
- `averageFallbacksPerRun: 4`

This is much better than the earlier state, but the writing layer still needs stronger inference if we want true production-grade output quality.

## Local run

```bash
cd roleforge
npm install
npm run build
npm run start
```

Then open:

```bash
http://localhost:8806
```

## Environment

Example envs are in `.env.example`.

Important ones:

- `ROLEFORGE_PROVIDER`
- `ROLEFORGE_OLLAMA_MODEL`
- `ROLEFORGE_OPENAI_MODEL`
- `ROLEFORGE_EMBEDDING_PROVIDER`
- `OPENAI_API_KEY`
- `ROLEFORGE_PORT`

### Recommended local setup

- model provider: `ollama`
- local model: `qwen2.5:3b`
- embedding provider: `ollama` or `openai`

### Recommended production setup

- writing model provider: `openai`
- embedding provider: `openai`
- database: `Supabase Postgres`
- vector search: `pgvector`
- file storage: `Supabase Storage`

## Production readiness

RoleForge is now a strong **pre-production** app, but not yet a full public production deployment.

### Already in place

- sign-up / sign-in
- private user-scoped runs
- rate limiting
- same-origin validation for writes
- hardened response headers
- deterministic scoring backbone

### Still required for full production

1. Move users, sessions, and runs from local JSON files to Postgres/Supabase.
2. Move vector storage from local JSON to `pgvector`.
3. Store uploaded CVs in object storage instead of request memory only.
4. Add password reset and email verification.
5. Add distributed rate limiting.
6. Add background jobs for long agent runs.
7. Add monitoring, logging, and failure analytics.
8. Use hosted inference for the writing agents in production.

## Recommended deployment path

### Short term

- host the app/API on Railway or Render
- keep Ollama only for local development
- use hosted model inference in production

### Full production target

- app/API: Next.js or Node service
- auth/database/storage: Supabase
- vectors: `pgvector`
- background jobs: worker or queue-backed jobs

## Useful scripts

Check the agent setup:

```bash
npm run agents:check
```

Run the backend smoke test:

```bash
npm run smoke
```

Type-check the backend:

```bash
npm run check
```

## Repo guide

- `server.mjs`
  - app server, auth endpoints, upload flow, UI shell
- `src/auth.ts`
  - local auth/session handling
- `src/nlp.ts`
  - NLP extraction and role/theme logic
- `src/retrieval.ts`
  - retrieval context builder
- `src/agents/`
  - agent implementations
- `src/orchestrator.ts`
  - end-to-end run orchestration
- `src/persistence.ts`
  - run storage

## Next highest-impact work

1. Upgrade the writing agents so they fall back less often.
2. Move persistence to Supabase/Postgres.
3. Move vector storage to `pgvector`.
4. Add password reset and email verification.
5. Prepare deployment config for Railway/Render plus hosted inference.
