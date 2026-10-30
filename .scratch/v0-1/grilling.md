# v0.1 grilling: decisions so far

_Owner answers, 2026-10-30. Not yet turned into ADRs or tickets._

## Scope
- v0.1 ships in two steps:
  - **v0.1a:** provider layer, `settings.json`, the AI interviewer on Two sum, graded Feedback.
  - **v0.1b:** 10 original problems, plus polish.
- **No code runner in v0.1.** It moves to v0.3 (v0.1 AI interviewer → v0.2 mic → v0.3 code runner).
- Every OS is a hard requirement: macOS, Linux and Windows, x64 and arm64 (now in AGENTS.md).

## Models
- Designed and tested against Ollama (~8B, local) and one cloud key from day one. Small models set the bar for prompts.
- First run: if no model is set, the Start screen shows one short step (pick Ollama, which is detected automatically, or paste a cloud key). After that, models are changed in a new **Model** tab in Settings.

## Interviewer
- The AI always reads the code to judge correctness. It asks the candidate to trace an example only when the situation calls for it (they haven't tested, or it suspects a bug).
- It sees a **snapshot of the code each time the candidate speaks**. It never comments on code on its own, except when the candidate says they're done.
- On a long silence (~2–3 min with no talking or typing) it gives **one neutral check-in**, never a hint. It gives hints only when asked.

## Feedback (renamed from "Debrief")
- "Debrief" is renamed **Feedback** everywhere: UI, code, glossary.
- Hire scale: the glossary's six levels (Strong hire, Hire, Lean hire, Lean no hire, No hire, Strong no hire). Confirmed later in place of four levels. Scored per area (problem solving, coding, testing, communication), and every point quotes a transcript line.
- Ships in v0.1a.

## Round 3 (after docs/research/10)
- **Floor Manager:** keyword rules only in v0.1. The small AI classifier comes with the mic in v0.2.
- **Reference solution:** the interviewer sees the full code, and a check in code blocks any reply that copies it.
- **Verdict:** the AI scores each area with evidence, and a fixed table turns the scores into the verdict.
- **Hints:** asking for hints lowers the problem-solving score, but there's never a visible counter. The feedback explains it. (Fixes the BLUEPRINT/GLOSSARY mismatch: update GLOSSARY "Hint".)

- **Problem files:** `content/problems/<slug>/` with `statement.md`, `problem.yaml`, `interviewer.md` (notes, hint ladder, follow-ups), the reference solution and tests.
- **10 topics:** hash map (Two sum becomes this one), stack, intervals, sliding window, binary search, grid BFS, heap, LRU-style cache, topological sort, DP.

## Round 4 (after docs/research/08)
- **pi-ai is the provider library** (MIT, confirmed from the repo's LICENSE file). Pin the exact version and keep it behind our own provider interface. Needs ADR 0016.
- **Never Claude consumer OAuth:** pi-ai's built-in Anthropic provider registers it, so we write our own API-key-only Anthropic provider and turn off reading credentials from environment variables.
- **Providers in build order:** 1. "Continue with ChatGPT" (plan login; open-source local apps need no approval, per OpenAI's docs). 2. Ollama through its own API (`/api/chat`, which sets `num_ctx` and can turn thinking off). 3. API keys.
- **Grader:** uses the interviewer's model unless a different one is picked in Settings → Model. Feedback is marked "rough" on small local models. The ChatGPT plan rejects `temperature`, so grading needs a fallback there (for example, the median of several samples).
- **Data folder:** set `productName: "InterviewHarness"` now, before `settings.json`, and copy the current browser-storage preferences over once.
- **No keyring on Linux (`basic_text`):** save anyway, readable only by the user, and show a one-time note that it isn't encrypted. (LearnHarness always stores keys as plaintext `auth.json`.)

## For later (code runner, v0.3; see docs/research/09)
- Pyodide must run in a module Web Worker in a sandboxed renderer, not in the utility process. This corrects BLUEPRINT §5.1.
- It needs an `app://` protocol with COOP/COEP headers and the CSP sent as a header. Owner questions in 09 wait until v0.3.

## Saving
- Each interview is saved to disk (transcript, code, decisions log, feedback) so it can be replayed. No history screen in v0.1.

## Problems
- Claude drafts all 10 in our own words from classic patterns (no LeetCode text). The owner edits and approves each one.

## Still open
- Nothing for v0.1. The design tree is fully walked; waiting for the owner to confirm.

## Round 5 (after playing real rounds, 2026-10-30)
- **No phrase rules for meaning.** The Floor Manager decides only *when* the interviewer speaks (timing, barge-in, silence). What the candidate meant (a question, done with a phase, agreeing to move on) is the model's to understand: its reply to each turn comes back structured with its kind (answer, acknowledgement, offer to move on), the help it gave and the phase the conversation is really in. Replaces the keyword rules (question mark, "that's it", "yes") the spec planned for v0.1.
- **Phases follow the conversation, never strictly.** If the candidate moves ahead, the round follows; if they skipped something that matters, the interviewer may ask them to cover it first. Phases never move back.
- **Feedback shows no scores.** Area scores stay internal (they make the verdict, and are saved with the round).
