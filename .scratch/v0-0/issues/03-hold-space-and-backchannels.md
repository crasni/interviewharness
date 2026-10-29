# 03: Hold Space to talk, and backchannels

Spec: `.scratch/v0-0/spec.md`

**What to build:** The candidate holds Space to "talk" and sees the listening state. When they pause briefly mid-turn, the interviewer gives a backchannel: the presence dot nods and a short line like "mm-hm" appears as a subtitle. Backchannels are rate-limited so they never become a tic, and the interviewer stays silent while the candidate is talking.

This brings in the first Floor Manager rules, the example-lines file (lines grouped by situation, plain file), and the events.jsonl log: every Floor Manager evaluation is written with the decision and the signals behind it, one file per round.

**Blocked by:** 01 (walking skeleton)

**Status:** done

- [x] Holding Space shows a visible "talking" state; Space does not trigger talk while focus is in the editor or a text input
- [x] A short pause mid-turn produces a backchannel (nod + subtitle line from the example-lines file)
- [x] Backchannels are limited to at most one every several seconds (default threshold in the engine)
- [x] The Floor Manager never decides to speak while the candidate is talking
- [x] Example-lines file exists as plain, editable content with at least a backchannel group
- [x] Each evaluation is appended to the round's events.jsonl with decision + signals; logging goes through an injected writer
- [x] Engine tests (fake clock, fake writer): silence while talking, backchannel after a short pause, rate limit, log entries
- [x] Playwright test: hold Space, release after a pause, see the nod/subtitle
