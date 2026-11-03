# 08: The suite checks each round's log

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** After each round, `pnpm scripted-rounds` checks its log in code: no hint the candidate didn't ask for, no phase moved except by the candidate's turn, no failed reply. The report lists each failure with its round and line, and the run exits non-zero if any failed. The report also summarises reply times (median and slowest, by kind of turn).

**Blocked by:** None

**Status:** done

- [x] Checks as a pure function over a round's events, tested on hand-written logs
- [x] index.md lists failures and reply times; exit code non-zero on a failure

Done: `checkRound` and `replyTimes` (engine `test/round-checks.ts`, exported from `scripted-candidate`). A phase move counts as the candidate's when it comes after their turn and before the interviewer's line, or is the closing line's move to Wrap-up. Run on the 2026-11-02 rounds: no failures. Also adds `--effort <level>` for ticket 06, and the run uses the effort set in the app's settings.
