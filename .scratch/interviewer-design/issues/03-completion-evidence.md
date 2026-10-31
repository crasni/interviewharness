# 03: A missed bug counts only after the candidate said they were done

**What to build:** A candidate who asks for debugging help while still working is not graded as having handed in buggy work.

**Blocked by:** 02

**Status:** needs-triage

- [ ] The round records when the candidate says their code is done, apart from finishing an explanation
- [ ] The missed-bug cap applies only to a bug in code the candidate had said was done; a mistake the interviewer was involved in before that is not enough
- [ ] A regression test reproduces it: debugging help before any "done" doesn't trigger the cap; a real "done" with a bug still gets it
- [ ] Hint and testing caps, areas and the verdict table are otherwise unchanged
- [ ] Tested from candidate turns through the round record to `gradeRound`

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
