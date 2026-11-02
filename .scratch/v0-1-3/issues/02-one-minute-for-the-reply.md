# 02: One minute for the whole reply

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** One deadline per reply, from when it starts: every attempt and check gets what's left of a minute. Running out is a `timeout`, logged with its reason, and the candidate sees the notice that says to say it again.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Attempts and checks share one minute
- [ ] Running out after a rejected attempt shows the say-it-again notice, not the safe line
- [ ] The log says it timed out and how many attempts it made
