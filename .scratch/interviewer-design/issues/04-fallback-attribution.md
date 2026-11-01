# 04: A walkthrough asked for by a fallback line is credited to the interviewer

**What to build:** When both drafts are rejected and the fallback line asks the candidate to walk through their code, the round records that the interviewer asked, exactly as it does when a normal reply asks for a trace. The candidate's trace then isn't graded as their own idea.

**Blocked by:** 01

**Status:** done

- [x] A regression test reproduces it: two rejected drafts, a walkthrough fallback, then a trace; the trace is recorded as asked for
- [x] Fallback lines record what they ask for the same way normal replies do; acknowledgement fallbacks ask for nothing
- [x] Tested through the shown words and what `gradeRound` sees

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
