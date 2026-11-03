# 06: Speed test, and default efforts

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** The agent runs the suite at each effort level of the owner's models (ChatGPT first; others with a key or local server at hand), compares reply times and whether the run passes, and sets the default for a newly added model to the fastest level that passes, in one table in `packages/providers`. The numbers go in the spec and next to the table. No speed test for users.

**Blocked by:** 01, 02, 03, 08 (the suite's pass/fail and reply times)

**Status:** done

- [x] Runs at each level, results recorded
- [x] Default by provider: `low` everywhere for now (one table entry, `defaultEffort`)

Done (2026-11-03): `pnpm scripted-rounds --effort low,medium` on `chatgpt/gpt-6.1-sol` (its levels: low, medium, high, xhigh, max), run `~/interviewharness-scripted-rounds/2026-11-02T18-29-49-805Z`. Every check passed at both.

| Effort | All replies, median | Ordinary turns, median / slowest | Done turns, median / slowest | Replaced, median |
| --- | --- | --- | --- | --- |
| low | 5.4 s | 5.4 / 9.0 s | 9.7 / 14.3 s | 20.3 s |
| medium | 5.6 s | 5.3 / 12.5 s | 10.6 / 14.9 s | 26.0 s |

Before v0.1.3 (2026-11-02, low): done turns 9.6–17.7 s. Medium was no better by the judge's notes, so the default stays `low`, which is gpt-6.1-sol's lowest level. Other providers weren't measured (no key at hand); they default to `low` too, clamped by pi-ai to the nearest level a model offers. The old-phase rewrite still fired twice in six rounds at each level.

Found in these runs and fixed after: every asked-for hint and fishing guess was replaced after two `solution-leak` rejections (about 20 s), since the check called the hint itself a description of the solution. The owner decided (2026-11-03) that a hint at the allowed rung passes when help was asked for. Also decided: "Sounds reasonable" to a fishing guess is fine (it leaves them to find out if it works), and offering testing after "I'm done" is allowed.
