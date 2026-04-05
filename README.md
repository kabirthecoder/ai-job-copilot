# AI Research + Job Copilot

An MVP for analyzing resume-job fit, identifying skill gaps, and generating targeted project and interview suggestions.

## Current MVP

- Resume text + job description input flow
- Server-side fit analysis endpoint
- Match score, skill overlap, missing skills, project ideas, and interview prep suggestions
- UI designed for future expansion into chat, saved sessions, and real LLM workflows
- Real `.txt` and `.pdf` resume ingestion with extracted text loaded into the form
- Typed saved-analysis models with local browser storage fallback
- Real Supabase-ready client helpers plus optional remote sync for saved analyses when env vars are present
- Local-first LLM support through Ollama, with OpenAI and mock fallback modes

## Planned Next Steps

1. Add Supabase auth screens and user-specific saved history
2. Plug in embeddings and retrieval for better matching
3. Add model-powered bullet rewriting and cover letter drafting
4. Introduce prompt versioning and evaluation metrics
5. Add a conversational chat mode over resume + job context

## Environment

LLM variables:

- `LLM_PROVIDER` can be `ollama`, `openai`, or `mock`
- `OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434`
- `OLLAMA_MODEL` defaults to `llama3.2:1b`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

Optional Supabase variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_TABLE` defaults to `saved_analyses`

If they are missing, the app keeps using local browser storage for saved analyses. If they are present, the app will also try to insert each saved analysis into Supabase through its REST API.

## How To Use

1. Run `npm install` once.
2. Start the app with `npm run dev`.
3. Open `http://localhost:3000`.
4. Paste your resume text, a job description, and optional name/company.
5. Click `Analyze Fit` to generate the project, interview, recruiter, and outreach suggestions.
6. Use `Save analysis` to store the result locally, and Supabase will sync it too if configured.

## Supabase Setup

Create a table like `saved_analyses` with JSONB columns for `input` and `result`, plus text columns for `id`, `source`, `created_at`, and `updated_at`. Add an insert policy for the anon key if you want browser writes to work.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
