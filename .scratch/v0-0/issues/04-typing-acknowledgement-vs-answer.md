# 04: Typing what you said: acknowledgement vs answer

Spec: `.scratch/v0-0/spec.md`

**What to build:** The candidate types what they said; it appears dimmed in the subtitle area as their words. When their turn ends, the interviewer responds: a statement gets an acknowledgement ("Okay, that makes sense"), a question (text ending in "?") gets an answer. The interviewer never starts speaking while the candidate holds Space, and if the candidate starts talking while the interviewer is speaking, the interviewer stops (barge-in). Lines vary instead of repeating.

**Blocked by:** 03 (hold Space to talk, and backchannels)

**Status:** done

- [x] Typed text is shown dimmed as the candidate's words
- [x] After the turn ends, a statement gets an acknowledgement and a question gets an answer, from the example-lines file
- [x] The interviewer never starts speaking while Space is held
- [x] Holding Space while the interviewer speaks stops it (barge-in)
- [x] No line repeats immediately
- [x] Every decision is logged with its signals
- [x] Engine tests: acknowledgement vs answer, no speaking during talk, barge-in
- [x] Playwright test: type a question, see an answer subtitle
