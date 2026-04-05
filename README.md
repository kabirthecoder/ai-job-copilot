# AI Research + Job Copilot

Local-first career intelligence app for analyzing resume-job fit, extracting skill gaps, generating tailored project ideas, and drafting application materials.

## What Works Today

- Resume upload from `.pdf` and `.txt`
- Automatic resume text extraction into the editor
- Job description analysis
- Rule-based fit scoring and ATS-style score
- Matched and missing skill detection
- Project suggestions, recruiter notes, interview questions, and next steps
- Cover letter snippet, cold email snippet, and portfolio pitch
- Local Ollama integration with `llama3.2:1b`
- Local browser save history
- Optional Supabase sync scaffolding

## Recommended Local Run Mode

`next dev` has been flaky with asset serving in this environment, so the stable path is the production local server:

```bash
npm install
npm run local
```

Then open `http://localhost:3002`.

## Available Scripts

- `npm run local` builds the app and starts the stable local server on port `3002`
- `npm run build` creates the production build
- `npm run start -- --port 3002` starts the production build manually
- `npm run dev` starts the Next.js dev server

## Environment

### LLM

- `LLM_PROVIDER` can be `ollama`, `openai`, or `mock`
- `OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434`
- `OLLAMA_MODEL` defaults to `llama3.2:1b`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

### Optional Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_TABLE` defaults to `saved_analyses`

If Supabase env vars are missing, saved analyses stay in local browser storage.

## How To Use

1. Start the app with `npm run local`.
2. Open `http://localhost:3002`.
3. Upload a resume PDF or TXT file.
4. Confirm the extracted text appears in the resume field.
5. Paste a job description.
6. Click `Analyze Fit`.
7. Review the fit score, gaps, project ideas, and generated drafts.
8. Click `Save analysis` to keep a local history.

## Current Gaps

- No login/signup yet
- No 2FA yet
- No chat mode over resume + job description yet
- No full dashboard/history page yet
- No company web research layer yet

## Next Planned Upgrades

1. Automatic company and role research layer
2. Better JD parsing with must-have vs nice-to-have extraction
3. Smarter gap-closing project recommendation engine
4. Auth and saved-analysis dashboard
5. Resume bullet rewriting and richer drafting
