# 05: Reasoning picker in the room

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** Next to the model name in the room, a "Reasoning" picker for the interviewer model's effort, changeable mid-round. The next call uses the new level. Each change is logged as `effort-changed` with the old and new levels. Hidden when the model has no levels.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The picker shows the interviewer model's levels and current effort
- [ ] Changing it saves the model's effort and the next call uses it
- [ ] `effort-changed` is logged
- [ ] End-to-end test changing it mid-round
