# 09: A model reads each transcript

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** After the rounds, the Feedback model (`INTERVIEWHARNESS_JUDGE=provider/model` overrides) reads each transcript with the "what to look for" note and writes short notes per round into index.md: talking when it needn't, help unasked, repeated questions. The notes never fail the run.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Judge prompt and call, tested with the fake model
- [ ] Notes per round in index.md; a judge that fails leaves a line saying so, and the run's result unchanged
