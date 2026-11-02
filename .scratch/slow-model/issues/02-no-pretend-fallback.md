# 02: A failed reply never pretends it understood

Spec: `.scratch/slow-model/spec.md` · ADR 0017

**What to build:** When the model fails a reply to a candidate's turn (timeout, offline, rate limit, bad output), the interviewer says nothing. Today `fallBack` in `packages/engine/src/interviewer.ts` says a stock acknowledgement ("Okay, that makes sense."), which answers a clarifying question with a fake "okay". The intro and other lines the interviewer starts itself (not answers to the candidate) may keep their stock lines, since those don't pretend to have heard anything. The room's notice (`modelFailures` in `Room.tsx`) now says what happened and what to do, without mentioning a stock line. For example, for a timeout: "The model didn't answer within a minute. Say it again, or pick a faster model in Settings." It shows on every failure. The failure is still logged to `events.jsonl` with its error, and the round records nothing as said.

**Blocked by:** None (works alongside 01; 01 changes the timeout wording to "a minute")

**Status:** done

- [x] A failed reply to a turn speaks nothing and adds nothing to the transcript or the round's record
- [x] The intro's fallback still works as before
- [x] Every `ModelErrorKind` has notice text that's plain, literal, and doesn't mention a stock line
- [x] The notice shows on every failure, including several in a row
- [x] Engine tests that expect "Okay, that makes sense." after a failure (`interviewer.test.ts` around lines 230, 245, 261, 665) now expect silence plus a `model-failed` event

## Comments

- 2026-11-01: Done with a new floor signal, `no-words`, which lets go of the floor with `stop-preparing`. One grading change follows: the stock "okay" used to close the interviewer's open ask, so a trace after a failed reply counted as the candidate's own. Now the ask stays open, and that trace answers it.
