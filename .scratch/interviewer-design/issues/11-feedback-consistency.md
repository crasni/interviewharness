# 11: Feedback doesn't contradict itself and says when the round was short

**What to build:** The owner's Feedback listed the same trace under "went well" ("traced … successfully") and "to fix" (the wrong map state), and didn't mention that the round ended at 12½ of 45 minutes.

**Blocked by:** 08 (grading facts change there)

**Status:** done

- [x] The grading prompt keeps one moment out of both lists: a moment with a flaw goes under "to fix" only, or "went well" names only the part that went well
- [x] When the round ended with more than half its time left, the "why" says the scores rest on a short round
- [x] Hint and testing caps, areas and the verdict table are unchanged
- [x] Tested through `gradeRound` with a scripted grader: the prompt carries the round length and the new instruction

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it). Found in the owner's round of 2026-10-31 (`~/.config/InterviewHarness/rounds/2026-10-31T11-54-06-721Z`).
