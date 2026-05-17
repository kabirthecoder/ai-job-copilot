# AI Job Copilot / RoleForge

This repository now contains two stages of the same idea:

- the original `AI Job Copilot` MVP
- the newer `RoleForge` production-style multi-agent backend

If you are looking for the latest architecture, use:

- [/Users/kabirmehta/Documents/New project/roleforge/README.md](/Users/kabirmehta/Documents/New%20project/roleforge/README.md)

## Repo structure

### Baseline MVP

The original app is the lighter, earlier version focused on:

- resume/job fit analysis
- local-first usage
- simple UI flow
- earlier LLM integration experiments

### RoleForge

`roleforge/` is the current advanced version. It includes:

- secure user accounts and sessions
- private run history
- resume upload and extraction
- deterministic NLP parsing
- retrieval and embeddings
- deterministic fit scoring
- multi-agent CV and cover-letter generation
- production-minded backend hardening

## Which version should you use?

Use **RoleForge** if you want the current serious version of the product.

Start here:

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

## Current product direction

The project is no longer just “an LLM that reads a resume.”

The updated system is designed as:

- NLP-first
- retrieval-backed
- deterministic scoring
- multi-agent writing and review
- secure private user workspaces

That updated architecture is documented in detail in:

- [/Users/kabirmehta/Documents/New project/roleforge/README.md](/Users/kabirmehta/Documents/New%20project/roleforge/README.md)

## Current status

The backend has moved significantly beyond MVP:

- account sign-up/sign-in works
- each user only sees their own runs
- upload flow works
- parsing and scoring are now mostly deterministic
- writing agents remain the main LLM-dependent layer

The next major production steps are:

1. move persistence to Supabase/Postgres
2. move vector storage to `pgvector`
3. use hosted inference for writing agents
4. add password reset and email verification
5. deploy to Railway/Render or a Next.js + Supabase stack
