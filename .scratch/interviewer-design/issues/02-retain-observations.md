# 02: Keep what the candidate did when the interviewer's words fail

**What to build:** What the model observed about a candidate turn (they traced an example, found their own mistake, moved to another phase) stays in the round even when the interviewer's reply is rejected or fails.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A regression test reproduces it: the candidate traces an example and finds a bug, both reply drafts are rejected, and Feedback still sees the trace and the discovery
- [x] Observations are applied once, whether or not the reply is shown; a retried reply can't apply them again
- [x] Barge-in drops the stale reply but keeps what was observed about earlier turns
- [x] A failed reading of a turn records nothing; it never becomes evidence that the candidate didn't test
- [x] Tested through the Interviewer's public events and round record

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
