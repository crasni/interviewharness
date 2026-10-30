# 12: Graded Feedback

**What to build:** Ending the round asks for confirmation (Q24). After it ends, main grades the round: **facts computed in code** from the log (phases reached and time in each, hint levels used, whether the candidate tested, the final code); a **structured grading call** to the grader slot scoring problem solving, coding, testing and communication on a four-step scale, each with evidence ids pointing at transcript turns (unknown ids dropped, a score with no valid evidence lowered); **caps in code** (hints used cap problem solving more per rung, never reaching Test caps testing); **three samples** with the median per area; a **fixed table in core** turning the four area scores into the six-level verdict; then **one prose call** for why, what went well and what to fix, each point with the time of its evidence. The Feedback screen shows a loading state, the verdict and reason, area scores, timed points, a rough mark for small models, a Try again action on failure, and a way to start a new round. The Feedback is saved in the round's folder.

**Blocked by:** 01, 10

**Status:** done

**Owner's call (2026-10-30):** area scores are kept internally (they make the verdict, and are saved in the round's feedback.json) but are not shown on the Feedback screen.

- [x] End round asks for confirmation
- [x] The verdict table is a pure function in core with tests for its edges
- [x] Grading drops unknown evidence ids, applies hint and testing caps, and takes the median of three samples (engine tests with the scripted fake model)
- [x] The Feedback screen shows verdict, reason and timed points from the real round, replacing the sample (no area scores, by the owner's call)
- [x] Small-model Feedback is marked rough
- [x] A grading failure shows a plain error and Try again, which works without restarting the round
- [x] A Feedback file is saved in the round's folder with no credentials
- [x] End-to-end tests cover confirmation, a graded Feedback screen and the retry path

Spec: `.scratch/v0-1/spec.md`.
