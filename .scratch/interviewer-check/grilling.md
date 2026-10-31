# Interviewer redesign: decisions from grilling

_The owner's answers, 2026-10-30, after the Two sum round where the interviewer named the bug, led the testing and moved phases on its own questions. Research: `docs/research/11-testing-expectations.md`. The survey of similar systems (Rasa CALM, Parlant, Pipecat Flows, StratL, Daheim et al., LearnLM, τ-bench) is summarised below. This builds on ADR 0018, which is already built but not committed._

## What the research said
- **Our shape matches the field.** Code keeps the state and the model understands the turn: Rasa CALM, StratL, dialogue state tracking. A running summary of the round helps (Hasegawa et al., IWSDS 2025).
- **A model's labels on its own reply are unreliable** (Huang et al., ICLR 2024).
  - Prompt-only withholding leaks: CS50's Duck shows code up to a quarter of the time despite being told not to.
  - Reliable systems either fine-tune, let code pick the move, or check the reply separately (Daheim et al., EMNLP 2024).
- **Voice agents avoid extra blocking calls.** OpenAI's realtime guardrails run alongside speech.
- **Testing practice:** scripted regression tests, simulated users with an LLM judge, and pass^k for reliability (τ-bench).

## Decisions
1. **Speed.** One model call per reply. A second call, **the check**, runs before speaking only where help could slip:
   - after "done";
   - a hint request;
   - "I'm stuck";
   - "does this look right?";
   - a second check-in in a silence;
   - any reply the model marks as giving help.
2. **The check.** The same model is asked about the reply's words alone: do they give away a mistake, give a hint (and which rung), or describe the solution?
   - If yes, the reply is written once more with the reason, then replaced by a plain safe line.
   - The check's verdict, not the interviewer's own label, is what's recorded and graded.
3. **Models.** A small local model (8B on Ollama) must never leak help or the answer, but may sound plainer. Full quality is aimed at ChatGPT and API models.
4. **Moves.** The prompt says what not to do. Moves are not greyed out in the schema.
5. **Phases follow the candidate both ways.** Going back is allowed, e.g. from Test to Code to fix a bug. The interviewer's own questions never move the phase. (Changes ADR 0018's "forward only".)
6. **Memory.** The whole conversation goes into every prompt, plus the round-so-far block. No more 12-line window.
7. **Prompt.** Rules that always apply, plus a short part for the current phase only.
8. **Grading.** Any checking the candidate starts counts: walking an input through, test cases, edge cases.
   - Without checking of their own, testing is at most 2.
   - It's at most 1 only when they said "done" with a bug they never caught themselves.
   - This was changed after grilling: "never tested at all → 1" was too harsh for correct code.
9. **Testing the interviewer.** A fake-candidate suite, run by hand before a release, never in CI (no network in tests).
   - It runs against ChatGPT for now.
   - The fake candidates are: stuck, fishing for the answer, has a bug, finishes early, silent, and rambling.
   - Code checks `events.jsonl` (no unasked help; phases moved only by the candidate), and a model judges each transcript.
   - When Ollama lands, run the same suite on one local model before calling it safe.
10. **Order.** Commit what's built (ADR 0018), then this redesign, then the suite, then Ollama (ticket 08).

## Later, not now
- **Interviewer and checker as separate agents.** The check is already a separate call that sees only the reply's words. Later it could get its own model and prompt file, e.g. a small fast checker next to a bigger interviewer.
