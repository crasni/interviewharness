# 12: What the second real round showed: probe per answer, own-words probes, no invented employer, ask for questions

**What to build:** Four problems from the round played on 2026-10-31 (`~/.config/InterviewHarness/rounds/2026-10-31T13-32-30-552Z`) after tickets 08–11.

**Blocked by:** None

**Status:** needs-triage

- [ ] **One probe per answer, not per line.** The candidate fixed a probed trace and, in the same turn, gave a new wrong answer ("O(1) space"); because the last line was a probe, the prompt said "accept their answer and move on" and the code rejects any probe right after a probe. A new, different answer in that turn may get its own probe; the answer to the probe itself still gets none. Keep a hard limit so it can't become an interrogation (for example, never more than two probes in a row)
- [ ] **Probes in the interviewer's own words.** Two of three probes copied the prompt's examples word for word ("What does seen hold after index 1?"). The prompt describes what a probe does (ask what one step of *their* trace gives, or how *their* answer meets a constraint they agreed to) with generic or no examples, never ones taken from a problem
- [ ] **No invented employer.** Asked "what's the team like?", it made up day-to-day team details. This is a practice round with no real company: it says so briefly and kindly instead of inventing a team, role or company
- [ ] **Ask for their questions before goodbye.** It went from "sure" straight to goodbye. In Wrap-up it asks once whether they have questions before saying goodbye; enforced in code (a goodbye before that is written again), not only by the prompt
- [ ] Tested through the public Interviewer with scripted models; ADR 0017/0018 and `content/interviewer/lines.md` match

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
