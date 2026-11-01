# 10: Answer the question at the end of a turn, and don't take credit for the candidate's offer

**What to build:** Two small misreadings from the owner's round. "…do you want me to briefly explain why this works?" at the end of a follow-up answer was ignored; the interviewer jumped to the next follow-up. And the candidate's own offer "do u want me to trace with an example?" answered with "Yes, go ahead" was logged as the interviewer asking for the trace.

**Blocked by:** 09 (same files)

**Status:** done

- [x] A question to the interviewer inside a turn gets answered (briefly) before anything else, whatever the turn mainly is
- [x] Saying yes to something the candidate offered asks for nothing: their trace stays their own in the round record
- [x] Tested with scripted models through the round record

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it). Found in the owner's round of 2026-10-31 (`~/.config/InterviewHarness/rounds/2026-10-31T11-54-06-721Z`).
