# 02: A failed reply to your turn tells you to say it again

Spec: `.scratch/failed-replies/spec.md` · ADR 0017

Status: done

**What to build:** When the reply to the candidate's own turn fails, the room's notice says what happened and that they can say it again, so a question or hint request isn't left hanging. For example: "The model didn't answer. Say it again." and "The model didn't answer within a minute. Say it again, or pick a faster model in Settings." The engine's `model-failed` event says whether it was a reply to their turn; a failed intro or check-in still falls back to its example line, and its notice doesn't ask them to repeat anything. A failed login (`auth`) keeps its own advice, since saying it again won't help.

- [x] `model-failed` carries whether the failed reply answered the candidate's turn
- [x] For a turn: every kind but `auth` and `aborted` adds "Say it again" in plain words
- [x] For the intro and check-ins: the notice is unchanged
- [x] e2e: a failed turn reply shows "Say it again"; a failed intro doesn't

## Comments
- 2026-11-02: Done. `model-failed` carries `reply` (the failed reply's kind). The room's turn notices: offline "…Check your connection, then say it again.", rate-limit "…Wait a bit and say it again, or pick another model in Settings.", timeout "…Say it again, or pick a faster model in Settings.", bad-output and other "…Say it again." Login failures and stops keep their own text.
