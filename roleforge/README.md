# RoleForge

RoleForge is a separate, more agentic follow-up project to the baseline career copilot. The goal here is not just to call one model once, but to let specialized agents collaborate on resume parsing, job understanding, company research, gap analysis, resume rewriting, and application drafting.

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

## Next Build Direction

1. Add per-agent prompts and dedicated outputs
2. Persist agent traces and decisions
3. Add a console page to inspect each agent run
4. Make the cover-letter agent depend more explicitly on the parsed JD and detected gaps
5. Add a resume-tailoring workflow that outputs a revised resume artifact

## Agent Check

Run this inside `roleforge/` to inspect the current provider/model setup for every agent:

```bash
npm run agents:check
```
