# 02: One minute for the whole reply

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** One deadline per reply, from when it starts: every attempt and check gets what's left of a minute. Running out is a `timeout`, logged with its reason, and the candidate sees the notice that says to say it again.

**Blocked by:** None

**Status:** done

- [x] Attempts and checks share one minute
- [x] Running out after a rejected attempt shows the say-it-again notice, not the safe line
- [x] The log says it timed out and how many attempts it made

Done: `replyRules.timeout` now runs from the reply's start (`Call.startedAt`); the per-step `stepAt` is gone. Rejections live on the call, so a timeout logs them too.
