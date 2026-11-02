# Failed replies: say what to do, and say why

Status: open (01–03 done 2026-11-02; 04 waits for the reasons 01 logs)

Found by the fake-candidate check on 2026-11-02 (`pnpm scripted-rounds`, Two sum, `chatgpt/gpt-6.1-sol`). Builds on `.scratch/slow-model/` and ADR 0017 ("a reply to the candidate is never faked").

## Problem

3 of 5 scripted rounds had a reply to the candidate's turn fail:

- stuck-says-so: "Could you give me a small hint toward something faster?" timed out after 60 s.
- buggy-asks-help and works-through-everything: the third model call of the round failed after about 3 s with `error: other`.

The interviewer rightly said nothing (no faked "okay"), but:

1. **The candidate isn't told what to do.** The room's notice says "The model didn't answer." or "…Pick a faster model in Settings." and never "say it again", so a hint request can sit unanswered. `.scratch/slow-model/issues/02` gave "Say it again" as the example; the shipped text left it out.
2. **Nobody can tell why it failed.** `events.jsonl` records only the kind, and `other` covers everything unclassified, so the two 3-second failures can't be diagnosed.
3. **The scripted transcripts hide the notice**, so a reader (or a judge) sees a candidate ignored, not a candidate told the model failed.

## Out of scope

- Slow replies (5–8 s for "Okay, go on.", 15–25 s after "done"): a separate piece of work before voice.
- Whether "Want to walk through some test cases?" after "done" is allowed: the owner's call, not a bug.
