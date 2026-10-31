# 09: Reply for the phase the candidate's turn moved to

**What to build:** When a turn moves the round to a new phase, the reply follows the new phase's rules. In the owner's round the candidate gave their complexity while the round was still in Test; the reply was written for Test ("offer to move on to complexity"), so the model improvised "Shall we wrap up there?" with 40 minutes left and follow-up questions still to ask.

**Blocked by:** 08 (same files)

**Status:** needs-triage

- [ ] When the model reports a phase move and its reply is an offer to move on (or otherwise written for the old phase), the reply is written once more with the new phase's prompt; turns that don't move the phase cost no extra call
- [ ] Regression test: candidate answers the complexity question during Test with follow-ups left; the reply asks the first follow-up and never offers to wrap up
- [ ] The extra call is logged with its reason

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it). Found in the owner's round of 2026-10-31 (`~/.config/InterviewHarness/rounds/2026-10-31T11-54-06-721Z`).
