# 07: End the round and the debrief

Spec: `.scratch/v0-0/spec.md`

**What to build:** The candidate can end the round from the room and lands on a debrief: the interviewer's written feedback, laid out like real interview notes. It shows a verdict on the six-level scale (Strong hire … Strong no hire) with reasons, then "what went well" and "what to fix", each point tied to a moment in the round. In v0.0 the text is sample content, clearly marked as such. No charts, stat tiles or metrics. From the debrief the candidate can go back to the start screen.

**Blocked by:** 01 (walking skeleton)

**Status:** done

- [x] An "End round" action in the room leads to the debrief
- [x] Debrief shows a verdict with reasons, "went well" and "to fix" sections, each point with a moment reference
- [x] The content is clearly marked as sample
- [x] No metrics, charts or stat tiles
- [x] A way back to the start screen
- [x] Playwright test: start a round, end it, see the debrief, return to start
