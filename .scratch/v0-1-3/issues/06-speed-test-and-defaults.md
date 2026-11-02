# 06: Speed test, and default efforts

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** The agent runs the suite at each effort level of the owner's models (ChatGPT first; others with a key or local server at hand), compares reply times and whether the run passes, and sets the default for a newly added model to the fastest level that passes, in one table in `packages/providers`. The numbers go in the spec and next to the table. No speed test for users.

**Blocked by:** 01, 02, 03, 08 (the suite's pass/fail and reply times)

**Status:** needs-info (the owner signs in to ChatGPT for each run)

- [ ] Runs at each level, results recorded
- [ ] Default table by provider, used when a model is added
