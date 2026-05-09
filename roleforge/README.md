# RoleForge

RoleForge is a separate, more agentic follow-up project to the baseline career copilot. The current product mode is intentionally focused on one workflow: upload a resume, paste one job description, analyze fit, rewrite the CV, and produce a stronger cover letter.

This version includes a lightweight retrieval layer, local embeddings, richer NLP signals, and deployment scaffolding so it can grow into a production-style service.

## Design Goals

- Make agent responsibilities explicit instead of hiding them in one route
- Give each agent a typed contract for inputs and outputs
- Allow some agents to stay deterministic while narrative-heavy agents use an LLM
- Make it easy to later add per-agent memory, approvals, and tool permissions
- Keep the system inspectable so the user can see what each agent contributed

## Planned Agents

- `resume-agent`
  - extracts identity, skills, experience fragments, projects, and evidence
- `job-agent`
  - extracts role family, seniority, must-haves, nice-to-haves, language requirements, and themes
- `research-agent`
  - collects company context, product direction, and latest verified signals
- `gap-agent`
  - compares resume and job outputs to produce strengths, gaps, and focus areas
- `rewrite-agent`
  - rewrites resume bullets based on the role and gap analysis
- `cover-letter-agent`
  - drafts a role-specific cover letter using job + research + resume context
- `review-agent`
  - checks for generic wording, unsupported claims, and low-personalization output

## Model Assignment

Every agent in `roleforge/` now makes its own model call and can use its own provider/model assignment.

Global defaults:

- `ROLEFORGE_PROVIDER`
- `ROLEFORGE_OLLAMA_MODEL`
- `ROLEFORGE_OPENAI_MODEL`

Per-agent overrides:

- `ROLEFORGE_RESUME_AGENT_PROVIDER`
- `ROLEFORGE_RESUME_AGENT_MODEL`
- `ROLEFORGE_JOB_AGENT_PROVIDER`
- `ROLEFORGE_JOB_AGENT_MODEL`
- `ROLEFORGE_RESEARCH_AGENT_PROVIDER`
- `ROLEFORGE_RESEARCH_AGENT_MODEL`
- `ROLEFORGE_GAP_AGENT_PROVIDER`
- `ROLEFORGE_GAP_AGENT_MODEL`
- `ROLEFORGE_REWRITE_AGENT_PROVIDER`
- `ROLEFORGE_REWRITE_AGENT_MODEL`
- `ROLEFORGE_COVER_LETTER_AGENT_PROVIDER`
- `ROLEFORGE_COVER_LETTER_AGENT_MODEL`
- `ROLEFORGE_REVIEW_AGENT_PROVIDER`
- `ROLEFORGE_REVIEW_AGENT_MODEL`

Each agent can also override its base URL with the same naming pattern, for example:

- `ROLEFORGE_COVER_LETTER_AGENT_BASE_URL`

## Retrieval And NLP

RoleForge now has a pre-agent intelligence layer:

- `src/nlp.ts`
  - extracts skills, language requirements, seniority hints, and role themes
- `src/embeddings.ts`
  - supports `local`, `ollama`, or `openai` embeddings
- `src/retrieval.ts`
  - chunks resume and JD text, ranks relevant passages, and feeds the best hits into downstream prompts
- `src/vector-store.ts`
  - persists vectorized chunks in `data/vector-store/index.json`

This gives the agents better context than raw full-text prompting alone and is a practical stepping stone toward pgvector or a hosted vector database later.

## Agent Console And Persistence

Every `POST /run` request now persists a full agent trace under `data/runs/`.

New endpoints:

- `GET /runs`
  - returns recent persisted run summaries
- `GET /runs/:id`
  - returns one full run as JSON
- `GET /`
  - browser console for launching and inspecting focused CV/cover-letter runs
- `GET /console`
  - alias of the same browser console
- `GET /console/:id`
  - simple HTML detail page for one agent run

Each run now stores:

- NLP signals
- retrieval hits
- per-agent outputs
- agent notes
- whether an agent fell back
- a revised resume artifact
- review recommendation

## Local API And Deployment

RoleForge now includes a minimal HTTP entrypoint so it can be deployed as a small API service.

Local run:

```bash
npm install
npm run build
npm run start
```

Then send a `POST /run` request with:

```json
{
  "candidate": {
    "name": "Kabir",
    "email": "kabir@example.com",
    "resumeText": "..."
  },
  "target": {
    "targetRole": "ML Engineer",
    "companyName": "trivago",
    "companyWebsite": "https://www.trivago.com",
    "jobDescription": "..."
  }
}
```

The response now includes:

- `trace`
  - a step-by-step record of each agent run
- `rewrite.output.revisedResumeArtifact`
  - a markdown resume artifact tailored to the role
- `coverLetter.output.openingHook`
  - a reusable opening idea for the final application draft
- `gap.output.applicationStrategy`
  - tactical guidance for how to position the application

Deployment files:

- `.env.example`
- `Dockerfile`
- `.dockerignore`

## Fastest Deployment Path

For the current codebase, the cleanest first deployment target is a long-running Node host such as Railway or Render, not serverless.

Recommended production split:

- App/API: Railway or Render
- Storage/Auth/DB later: Supabase
- Local dev model: Ollama
- Production model: hosted API such as OpenAI

Why:

- this app currently runs as a persistent Node server
- the multi-agent flow can take longer than a typical serverless request
- local JSON run history is fine for local demos but should eventually move to a real database

### Railway / Render checklist

1. Set build command to `npm install && npm run build`
2. Set start command to `npm run start`
3. Set env vars from `.env.example`
4. Expose the service on `ROLEFORGE_PORT`
5. In production, prefer:
   - `ROLEFORGE_PROVIDER=openai`
   - `OPENAI_API_KEY=...`
   - `ROLEFORGE_OPENAI_MODEL=gpt-5.4-mini`

### Important production note

The current run history uses local files under `data/runs/`. That works for local development and simple container demos, but it is not durable multi-user storage. For a real production rollout, move persistence to Postgres/Supabase next.

Recommended embedding setups:

- local only
  - `ROLEFORGE_EMBEDDING_PROVIDER=local`
- Ollama embeddings
  - `ROLEFORGE_EMBEDDING_PROVIDER=ollama`
  - `ROLEFORGE_OLLAMA_EMBEDDING_MODEL=nomic-embed-text`
- Default local model in this repo is now `qwen2.5:3b` for a better balance of structured output quality and local performance.
- OpenAI embeddings
  - `ROLEFORGE_EMBEDDING_PROVIDER=openai`
  - `OPENAI_API_KEY=...`
  - `ROLEFORGE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small`

## Next Build Direction

1. Move persistence from local JSON files to Postgres/Supabase
2. Add auth and per-user run isolation
3. Swap the local embedding fallback for a real embedding provider or pgvector store
4. Add web research connectors for verified company/news enrichment
5. Improve the CV rewrite and cover-letter quality with stronger reviewer loops

## Agent Check

Run this inside `roleforge/` to inspect the current provider/model setup for every agent:

```bash
npm run agents:check
```
