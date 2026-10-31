# 08: Ask one probe when a handed-over answer looks wrong

**What to build:** When the candidate hands over an answer (to the interviewer's question, a follow-up, a trace, their complexity, an approach they ask about) and the interviewer can see it's wrong or ignores a constraint they agreed to, it asks **one** short neutral question that makes them check it themselves, then accepts whatever they say and moves on. In the owner's round it moved on silently past a wrong trace ("seen[1] = 0") and a "too big for memory" answer that sorted in memory and lost the original indexes; the Feedback caught both.

**Blocked by:** None

**Status:** needs-triage

- [ ] A probe points them at a constraint they already agreed to ("Where does the data live while you sort it?") or asks what one step produces ("What does seen hold after index 1?"). It never says the answer is wrong, what the fix is, or what the right answer is
- [ ] One probe per answer: after their reply, the interviewer moves on whether or not they fixed it. Never while they're mid-work; never for a valid answer that differs from the reference
- [ ] The rules about mistakes, probing and staying quiet live in one prompt section instead of being repeated across the rules, the reply-by-turn list, the phase parts and "When they're done"; the prompt gets no longer overall
- [ ] A probe is its own ask (`asks: "probe"`). The check runs on it, and the check's rules say a probe is not naming the mistake; a reply that names the mistake or the fix is still rejected
- [ ] The round records each probe. A mistake the candidate finds right after a probe isn't credited as found on their own, and doesn't trigger the missed-bug cap; caps and the verdict table are otherwise unchanged. The grader is told which corrections followed a probe
- [ ] ADR 0017 (answering-the-interviewer row) and ADR 0019 (probes are checked) are amended; GLOSSARY gains "Probe"
- [ ] Tested through the public Interviewer with scripted models: a wrong follow-up answer gets one probe then the next follow-up; a probe that names the fix is rejected; a correction after a probe isn't credited as own

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it). Found in the owner's round of 2026-10-31 (`~/.config/InterviewHarness/rounds/2026-10-31T11-54-06-721Z`).
