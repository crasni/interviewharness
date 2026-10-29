# Status: where we left off

_Last updated: 2026-10-30_

## Done
- [x] Market and competitor research (`research/00-market.md`)
- [x] LearnHarness teardown from its source code (`research/01-learnharness.md`)
- [x] Deep research: voice and turn-taking, providers, building blocks (`research/02–04`)
- [x] Critique and revision of the concept, then the full blueprint (`BLUEPRINT.md`)
- [x] Decisions logged (`DECISIONS.md`, D1–D13; new ones in `docs/adr/`, from 0014)
- [x] Agent skills set up (`docs/agents/`), glossary started (`GLOSSARY.md`)
- [x] Name decided: **InterviewHarness** (`research/05-naming.md`)
- [x] **v0.0 interview room** (tickets 01–07 in `.scratch/v0-0/issues/`, all done): start, room and debrief screens, the early Floor Manager, click to talk, phases, problem panel, editor, transcript. The owner answered the open questions on 2026-10-30 (`.scratch/v0-0/questions.md`): every default kept; the practice problem is **Two sum** for now, in our own words.
- [x] **UI revision** (ADR 0015, `.scratch/ui-polish/backlog.md`): Editorial identity, softer corners, Mona Sans, the floating interviewer tile (it glides to the nearest corner when let go), transcript at the bottom.
- [x] **Settings** (`.scratch/settings/`, tickets 01–03): a sheet over any screen (⌘/Ctrl+,) with text size, theme, transcript default, how you talk, and the editor's language (Python, JavaScript, TypeScript, Java, C++, Go), autocomplete and syntax highlighting; resizable problem and transcript edges, remembered.
- [x] **Bought `interviewharness.dev`** on Cloudflare Registrar (2026-10-29; $8.20 first year, auto-renews at $12.20/yr, expires 2027-10-29 unless renewed)

## Not done yet
- Public repo: https://github.com/crasni/interviewharness (org `interviewharness` exists; moving the repo there is deferred). npm scope `@interviewharness` not yet created.
- Domain is bought, but DNS, website and email aren't set up (next: Cloudflare Pages landing page, Email Routing for hello@).

## Next steps (in order)
1. **v0.1: a real AI interviewer.**
   - Provider layer (pi-ai + OpenAI-compatible + Ollama), safeStorage keys. Blocked on pi-ai's license (see below); fallback AI SDK v6.
   - `settings.json` in user data (BLUEPRINT §5.3): provider settings go there, and the room preferences move there from browser storage.
   - Pyodide/QuickJS runner (Python and JavaScript first; the editor already offers six languages).
   - AI interviewer using the example-lines file as tone guidance.
   - 10 original problems, replacing the stand-in Two sum.
   - Real debrief: verdict and written feedback with evidence. Add a confirmation to End round once there is feedback to lose (Q24).
2. **v0.2: the mic.** Silero VAD, local STT/TTS, speech detection as a talk mode (already shown, disabled, in Settings), the REC mark and its colour (Q6, the one question still open).
3. **Setup chores:** DNS, a landing page on Cloudflare Pages, Email Routing for hello@; move the repo to the `interviewharness` org; create the npm scope.

## Open questions
- pi-ai's license and maintainer (blocks D7). Fallback: AI SDK v6.
- Is SystemDesign.ai open source, and how good is it? (Check before v0.4.)
- When to apply for OpenAI's "Sign in with ChatGPT" partner program?
- Which local model sizes make an acceptable interviewer on an 8–16 GB laptop? (Needs an eval.)

## How to resume
Open this folder in Claude Code and say something like:
> "Read AGENTS.md and docs/STATUS.md, then let's do next step N."
