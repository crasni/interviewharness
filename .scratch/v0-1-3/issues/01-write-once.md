# 01: Write the reply for the phase the turn moved to

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** A reply's prompt also carries the part for the phase the candidate's turn may move the round to, so a turn like "I'm done" gets a reply written for the new phase on the first attempt. The `written-for-old-phase` rewrite stays as a safety net.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] The prompt carries the next phase's part next to the current one
- [ ] A "done" turn that moves the round costs one writing call (plus the check), with no `written-for-old-phase`
- [ ] The safety net still fires when the model writes for the old phase
- [ ] Moving back a phase works as today
