# 07: A few scripted rounds to try the interviewer on a real model

**What to build:** A small script the owner runs by hand that plays a few scripted candidates through full rounds on a real model and saves the transcripts to read.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

- [ ] Five or so scripted candidates: silent for long stretches, stuck and saying so, buggy and asking for help, finishing early, working through everything unprompted
- [ ] Runs on the existing public Interviewer and model interfaces, against whatever model is configured; saves each transcript and the model used
- [ ] Never runs in CI and needs no new dependencies
- [ ] A short note says what to look for: the interviewer speaking when it didn't need to, hints given unasked, repeated questions

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).
