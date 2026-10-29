# 05: Phases: intro, suggestions to move on, wrap-up

Spec: `.scratch/v0-0/spec.md`

**What to build:** The round moves through its phases the way a good interviewer leads it. The interviewer opens with a short intro explaining the format. When a phase runs past its share of the time, or the candidate seems done (a long pause after finishing, or saying something like "I think that's it"), it suggests moving on ("Want to start coding?"). The candidate can accept, and the phase advances; or decline, and the interviewer keeps the phase and waits before suggesting again. It never advances a phase on its own. Wrap-up ends with "any questions for me?".

**Blocked by:** 04 (typing what you said: acknowledgement vs answer)

**Status:** done

- [x] Coding round phases: Clarify, Approach, Code, Test, Complexity, Wrap-up
- [x] An intro line plays when the round starts
- [x] A phase suggestion is made on time overrun (default time shares in the engine) and when the candidate seems done
- [x] Accepting advances the phase and updates the top bar
- [x] Declining keeps the phase; the next suggestion waits longer
- [x] The phase never advances without the candidate agreeing
- [x] Wrap-up includes "any questions for me?"
- [x] Engine tests cover overrun, seems-done, accept, decline and back-off
- [x] Playwright test: accept a suggestion and see the phase change
