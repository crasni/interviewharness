# 01: Write the reply for the phase the turn moved to

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** A reply's prompt also carries the part for the phase the candidate's turn may move the round to, so a turn like "I'm done" gets a reply written for the new phase on the first attempt. The `written-for-old-phase` rewrite stays as a safety net.

**Blocked by:** None

**Status:** done

- [x] The prompt carries the next phase's part next to the current one
- [x] A "done" turn that moves the round costs one writing call (plus the check), with no `written-for-old-phase`
- [x] The safety net still fires when the model writes for the old phase
- [x] Moving back a phase works as today

Done: the turn prompt gains "If their turn moves the round on to <next>": reply for that phase, its part, and what to do if they're done with it too (`RoundSoFar.phaseAfterNext`, skips applied). The follow-up questions go in from one phase earlier. Only real rounds show how often the safety net still fires; ticket 06's runs count it.
