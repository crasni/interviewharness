# Status: where we left off

_Last updated: 2026-10-29_

## Done
- [x] Market and competitor research (`research/00-market.md`)
- [x] LearnHarness teardown from its source code (`research/01-learnharness.md`)
- [x] Deep research: voice and turn-taking, providers, building blocks (`research/02–04`)
- [x] Critique and revision of the concept, then the full blueprint (`BLUEPRINT.md`)
- [x] Decisions logged (`DECISIONS.md`, D1–D13; new ones in `docs/adr/`, from 0014)
- [x] Agent skills set up (`docs/agents/`), glossary started (`GLOSSARY.md`)
- [x] Name decided: **InterviewHarness** (`research/05-naming.md`)

- [x] **Bought `interviewharness.dev`** on Cloudflare Registrar (2026-10-29; $8.20 first year, auto-renews at $12.20/yr, expires 2027-10-29 unless renewed)

## Not done yet
- No code yet. Public repo: https://github.com/crasni/interviewharness (org `interviewharness` exists; moving the repo there is deferred). npm scope `@interviewharness` not yet created.
- Domain is bought, but DNS, website and email aren't set up (next: Cloudflare Pages landing page, Email Routing for hello@).

## Next steps (in order)
1. **v0.0 interview room**, spec in `.scratch/v0-0/spec.md`. Built inside the real scaffold (merges the old prototype and scaffold steps):
   - Electron + Vite + React + TS, pnpm workspaces + Turborepo; only the desktop app, `core` and `engine` for now
   - Start, room and debrief screens; early Floor Manager with lines from an example-lines file; no AI, no mic
   - Tests at two seams: the Floor Manager (fake clock) and the room UI (Playwright)
   - Tickets: `.scratch/v0-0/issues/` (start with 01, the walking skeleton)
2. **v0.1:**
   - Provider layer (pi-ai + OpenAI-compatible + Ollama), safeStorage keys
   - Pyodide/QuickJS runner
   - AI interviewer using the example-lines file as tone guidance
   - 10 original problems
   - Real debrief: verdict and written feedback with evidence

## Open questions
- pi-ai's license and maintainer (blocks D7). Fallback: AI SDK v6.
- Is SystemDesign.ai open source, and how good is it? (Check before v0.4.)
- When to apply for OpenAI's "Sign in with ChatGPT" partner program?
- Which local model sizes make an acceptable interviewer on an 8–16 GB laptop? (Needs an eval.)

## How to resume
Open this folder in Claude Code and say something like:
> "Read AGENTS.md and docs/STATUS.md, then let's do next step N."
