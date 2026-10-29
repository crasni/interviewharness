# Status: where we left off

_Last updated: 2026-10-29_

## Done
- [x] Market and competitor research (`research/00-market.md`)
- [x] LearnHarness teardown from its source code (`research/01-learnharness.md`)
- [x] Deep research: voice and turn-taking, providers, building blocks (`research/02–04`)
- [x] Critique and revision of the concept, then the full blueprint (`BLUEPRINT.md`)
- [x] Decisions logged (`DECISIONS.md`, D1–D13)
- [x] Name decided: **InterviewHarness** (`research/05-naming.md`)

- [x] **Bought `interviewharness.dev`** on Cloudflare Registrar (2026-10-29; $8.20 first year, auto-renews at $12.20/yr, expires 2027-10-29 unless renewed)

## Not done yet
- No code, no git repo. GitHub org `interviewharness` and npm scope `@interviewharness` not yet created.
- Domain is bought, but DNS, website and email aren't set up (next: Cloudflare Pages landing page, Email Routing for hello@).

## Next steps (in order)
1. **Reserve the name** (details and prices in `research/06-purchases.md`): buy `interviewharness.dev` (~$12/yr, Cloudflare or Porkbun); create the GitHub org `interviewharness` and the npm scope `@interviewharness` (free). Apple Developer ($99/yr) and Windows signing (SignPath, free for OSS) wait until the first release.
2. **v0.0 prototype:** a clickable black-and-white **interview room** with a fake interviewer. Use it to settle the look and the interaction:
   - Presence dot that breathes and nods
   - Subtitle strip
   - Hold-Space-to-talk states
   - Phase timer
   - Hint ladder
3. **Scaffold the monorepo** (layout in BLUEPRINT §6): Electron + Vite + React + TS; packages `core`, `engine`, `providers`, `voice`, `runner`, `board-graph`, `content-schema`; layering enforced by lint; fake-LLM test harness.
4. **v0.1:**
   - Provider layer (pi-ai + OpenAI-compatible + Ollama), safeStorage keys
   - CodeMirror and the Pyodide/QuickJS runner
   - Phase machine, one persona skill
   - 10 original problems
   - Evidence scorecard

## Open questions
- pi-ai's license and maintainer (blocks D7). Fallback: AI SDK v6.
- Is SystemDesign.ai open source, and how good is it? (Check before v0.4.)
- When to apply for OpenAI's "Sign in with ChatGPT" partner program?
- Which local model sizes make an acceptable interviewer on an 8–16 GB laptop? (Needs an eval.)
- Monorepo tool: pnpm workspaces alone, or + Turborepo?

## How to resume
Open this folder in Claude Code and say something like:
> "Read AGENTS.md and docs/STATUS.md, then let's do next step N."
