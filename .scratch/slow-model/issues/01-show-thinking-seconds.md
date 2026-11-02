# 01: Show "Thinking" with seconds, and wait longer

Spec: `.scratch/slow-model/spec.md` · ADR 0017

**What to build:** While the interviewer is preparing a reply, the tile label (`tileLabels.preparing` in `apps/desktop/src/renderer/src/room/Room.tsx`) shows how long it has been thinking: "Thinking" for the first second, then "Thinking · 3s", "Thinking · 4s" and so on, counted from the `preparing` decision. Anything that ends preparing (`stop-preparing`, the words arriving, a failure) clears the count. Raise `replyRules.timeout` (`packages/engine/src/interviewer.ts`) from 10 s to 60 s, the same one-minute limit the model check already uses (ADR 0016). Add a short amendment to ADR 0017: a turn's reply may take up to a minute, and the room shows that it's thinking.

**Blocked by:** None

**Status:** done

- [x] The tile counts seconds while preparing and clears when preparing ends
- [x] The count uses tabular figures, so the label doesn't jiggle (role tokens only)
- [x] `replyRules.timeout` is 60 s; engine tests that assumed 10 s are updated
- [x] A test covers a slow reply (say 30 s, fake clock) that is still spoken, not replaced by a fallback
- [x] ADR 0017 has the amendment
