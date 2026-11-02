# 08: The suite checks each round's log

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** After each round, `pnpm scripted-rounds` checks its log in code: no hint the candidate didn't ask for, no phase moved except by the candidate's turn, no failed reply. The report lists each failure with its round and line, and the run exits non-zero if any failed. The report also summarises reply times (median and slowest, by kind of turn).

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Checks as a pure function over a round's events, tested on hand-written logs
- [ ] index.md lists failures and reply times; exit code non-zero on a failure
