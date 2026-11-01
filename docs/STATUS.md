# Status: where we left off

_Last updated: 2026-11-01_

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
- [x] **Settings** (`.scratch/settings/`, tickets 01–03): a card in the middle of any screen (⌘/Ctrl+,) with side tabs for appearance (text size, theme), interview (transcript default, how you talk) and the editor's language (Python, JavaScript, TypeScript, Java, C++, Go), autocomplete and syntax highlighting; resizable problem and transcript edges, remembered.
- [x] **Bought `interviewharness.dev`** on Cloudflare Registrar (2026-10-29; $8.20 first year, auto-renews at $12.20/yr, expires 2027-10-29 unless renewed)
- [x] **The app keeps the round** (ADR 0018, after a real Two sum round on 2026-10-30): the model reports what it observed and what its reply does; the app moves phases only on the candidate's words, rejects a mistake named unasked, records who started each trace and who found each mistake, and tells the model the round so far every turn. New Follow-up phase when the candidate finishes early; the interviewer says goodbye once. Grading caps testing at 2 without testing of their own (`docs/research/11`). Not yet tried in a real round.
- [x] **The check** (ADR 0019, grilling in `.scratch/interviewer-check/grilling.md`): where help could slip in, a second call judges the reply's words before they're said, and its verdict is what's graded. Phases follow the candidate back as well as ahead; every prompt carries the whole conversation and the current phase's part; testing is capped at 2 without checking of their own, and at 1 for a bug called done and never caught. Not yet tried in a real round.
- [x] **v0.1.0: a real AI interviewer** (`.scratch/v0-1-0/`, tickets 01–12 all done, 2026-11-01): the model writes the interviewer's words while the Floor Manager decides when; graded Feedback with a fixed verdict table; settings.json and the InterviewHarness data folder. Models: Continue with ChatGPT, Ollama (native API), API keys for OpenAI, Anthropic, Google and OpenRouter, and an OpenAI-compatible server, each checked to answer before it's saved. CI runs on macOS, Windows and Linux. The model setup was redesigned from research (`docs/research/12`): three ways in on a full-height Start screen, Settings → Model with the app's own Picker. The editor gained switches for closing brackets, matching brackets, find and replace, and wrapping. Not yet tried with a real cloud key.
- [x] **The mark** (ADR 0020, files in `brand/`): passing the floor, a solid dot, an open ring and the arc between them, optically centred; app icon tiles, a heavier cut for small sizes, PNG exports and the window icon. The wordmark is set in Newsreader; `.icns`/`.ico` come with packaging.

## Not done yet
- Public repo: https://github.com/crasni/interviewharness (org `interviewharness` exists; moving the repo there is deferred). npm scope `@interviewharness` not yet created.
- Domain is bought, but DNS, website and email aren't set up (next: Cloudflare Pages landing page, Email Routing for hello@).

## Next steps (in order)
0. **Play a real round** on the new interviewer (ADR 0018, 0019), then build the **fake-candidate suite** (`.scratch/interviewer-check/grilling.md`, decision 9). It's run by hand against ChatGPT, never in CI. Ollama now works (ticket 08); the suite is run on one local model before that model is called safe.
1. **v0.1.1: connections.** Spec: `.scratch/v0-1-1/spec.md`, tickets in `.scratch/v0-1-1/issues/`; ADR 0021; research `docs/research/12` and `13`. Your models in the pickers, a searchable Add list, many key providers, named OpenAI- or Anthropic-compatible servers, OpenRouter sign-in. Comes before v0.1.2 (owner, 2026-11-01).
2. **v0.1.2:** 10 original problems (Claude drafts, the owner reviews) in the new problem folder format.
3. **v0.2: the mic.** Silero VAD, local STT/TTS, speech detection as a talk mode, the AI floor classifier, the REC mark and its colour (Q6, still open). The owner wants speech transcribed once they stop talking and put in all at once, not shown live (2026-10-30).
4. **v0.3: the code runner.** Pyodide/QuickJS in a sandboxed worker (`docs/research/09`; its owner questions wait until then).
5. **Setup chores:** DNS, a landing page on Cloudflare Pages, Email Routing for hello@; move the repo to the `interviewharness` org; create the npm scope.

## Open questions
- Is SystemDesign.ai open source, and how good is it? (Check before v0.4.)
- Which local model sizes make an acceptable interviewer on an 8–16 GB laptop? (Needs an eval.)

## How to resume
Open this folder in Claude Code and say something like:
> "Read AGENTS.md and docs/STATUS.md, then let's do next step N."
