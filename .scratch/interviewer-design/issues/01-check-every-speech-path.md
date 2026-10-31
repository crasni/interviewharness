# 01: The check's verdict applies to check-ins too

**What to build:** A check-in whose words the check rejects is never shown, just like a rejected reply to a turn. Today a second check-in that names the candidate's mistake gets through when it reports `hintLevel: none`.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

- [ ] A regression test reproduces it: a second check-in with `namesMistake: true` and `hintLevel: none` is rejected, not shown, and not recorded as a hint
- [ ] Replies to turns and check-ins go through one rejection path that doesn't depend on optional fields of the reply; the Interviewer's public API is unchanged
- [ ] Existing hint permissions, the retry limit, fallback lines and the solution guard keep their tests
- [ ] Tested through the Interviewer's public events, model requests and round record, with scripted models and a fake clock

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
