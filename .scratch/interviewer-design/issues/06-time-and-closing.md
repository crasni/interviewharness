# 06: Sparse time reminders and one goodbye

**What to build:** The interviewer gives an occasional time reminder at a natural pause, and closes the round once. End round stays the candidate's.

**Blocked by:** 05

**Status:** done

- [x] Time reminders are sparse and wait for a natural pause; a phase running long never interrupts the candidate mid-work
- [x] Finishing early leads to the follow-up questions (ADR 0018) or to closing; "thanks" after the goodbye doesn't reopen the round
- [x] A timer can lead to a closing line but never ends the round by itself; End round always wins
- [x] Tested with a fake clock through the Interviewer's public events

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
