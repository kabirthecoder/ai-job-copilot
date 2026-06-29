# DevMind

**AI codebase onboarding agent — ask anything about any GitHub repo.**

> "How does authentication work?" · "Why was the payment system rebuilt?" · "What breaks if I change the database schema?"

DevMind indexes any GitHub repository and lets you ask natural-language questions about the code, git history, and architecture. One command, zero setup.

```bash
npx devmind ask https://github.com/vercel/next.js "how does the app router work?"
```

---

## Why DevMind?

New engineers spend 1–3 months becoming productive on a codebase. Existing tools (Copilot, Cursor, Cody) require IDE plugins and only see code — not *why* decisions were made.

DevMind is different:
- **Works on any public repo** — no IDE required, no plugin to install
- **Git-history aware** — answers "why was this built this way" from commit messages and PR descriptions
- **Role-specific onboarding** — generates a personalized `ONBOARDING.md` for frontend, backend, devops, or data engineers
- **Multi-agent routing** — automatically picks the right agent (code search, history analysis, architecture overview) based on your question
- **Fully open source** — self-host it, extend it, or run it against private repos with a GitHub token

---

## Install

```bash
# Run directly (no install)
npx devmind ask <github-url> "your question"

# Or install globally
npm install -g devmind
```

**Requirements:** Node 18+, a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

---

## Commands

### Ask a question

```bash
# One-shot question
devmind ask https://github.com/expressjs/express "how does middleware chaining work?"

# Interactive chat mode
devmind ask https://github.com/expressjs/express
```

### Generate an onboarding guide

```bash
# Print to terminal
devmind guide https://github.com/your-org/your-repo --role backend

# Save to file
devmind guide https://github.com/your-org/your-repo --role frontend --output ONBOARDING.md
```

Roles: `frontend` · `backend` · `fullstack` · `devops` · `data`

### Index a repo (pre-cache)

```bash
devmind index https://github.com/expressjs/express

# Force re-index
devmind index https://github.com/expressjs/express --force
```

### List cached repos

```bash
devmind list
```

---

## How it works

```
GitHub API → fetch files + commits + PRs
     ↓
AST-aware chunking (80-line chunks)
     ↓
Gemini embeddings (gemini-embedding-001, 3072-dim)
     ↓
Local vector store (~/.devmind/store)
     ↓
Question → Router Agent (code / history / architecture / hybrid)
     ↓
┌─────────────────────────────────────────────┐
│  CodeAgent    → semantic search over chunks │
│  HistoryAgent → git commits + PR reasoning  │
│  ArchAgent    → file tree + entry files     │
└─────────────────────────────────────────────┘
     ↓
Answer with cited sources
```

### Agents

| Agent | Handles | Data source |
|---|---|---|
| **CodeAgent** | How is X implemented? | Vector search over code chunks |
| **HistoryAgent** | Why was X built this way? | Commit messages + PR descriptions |
| **ArchAgent** | How is the system structured? | File tree + entry/config files |
| **GuideAgent** | Generate onboarding doc | All of the above |

The **Router** classifies each question and dispatches to the right agent. Ambiguous questions use a hybrid approach — both CodeAgent and HistoryAgent run in parallel, then a synthesis step merges the answers.

---

## Private repos

```bash
export GITHUB_TOKEN=ghp_your_token
devmind ask https://github.com/your-org/private-repo "..."
```

A GitHub token also increases the API rate limit from 60 to 5,000 requests/hour.

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | required | Free key from [aistudio.google.com](https://aistudio.google.com/apikey) |
| `GITHUB_TOKEN` | optional | Unlocks private repos + higher rate limits |
| `DEVMIND_MODEL` | `gemini-2.5-flash` | LLM model to use |
| `DEVMIND_STORE_PATH` | `~/.devmind/store` | Where to cache indexes |

---

## Roadmap

- [ ] `devmind diff <pr-url>` — explain what a PR changes and why
- [ ] `devmind dep <file>` — "what breaks if I change this file?"
- [ ] pgvector backend for large monorepos
- [ ] GitHub Actions integration (auto-generate ONBOARDING.md on new repos)
- [ ] Web UI

---

## Stack

- **LLM:** Gemini 2.5 Flash (free tier, via OpenAI-compatible API)
- **Embeddings:** gemini-embedding-001 (3072-dim)
- **Vector search:** cosine similarity over local JSON store
- **GitHub:** Octokit REST API
- **CLI:** Commander + Inquirer + Ora + Chalk

---

## License

MIT
