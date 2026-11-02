# 05: Reasoning picker in the room

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** Next to the model name in the room, a "Reasoning" picker for the interviewer model's effort, changeable mid-round. The next call uses the new level. Each change is logged as `effort-changed` with the old and new levels. Hidden when the model has no levels.

**Blocked by:** 03

**Status:** done

- [x] The picker shows the interviewer model's levels and current effort
- [x] Changing it saves the model's effort and the next call uses it
- [x] `effort-changed` is logged
- [x] End-to-end test changing it mid-round

Done: the room has no model name to sit next to, so the picker sits in the room bar before the timer, labelled "Reasoning". The interviewer's model is built again for each call, so the next reply uses the new effort. `effortChanged` entries name the model, from and to. The Settings pickers and this one share `models/Reasoning.tsx`.
