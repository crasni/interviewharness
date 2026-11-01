# 10: The interviewer reads code, gives hints by ladder, and guards the solution

**What to build:** Each thing the candidate says carries a snapshot of the editor's code and language, which is logged and given to the interviewer. The interviewer comments on code only when the candidate says they're done, or when it's answering a direct question about their code; then it reads the code against the reference solution and may ask the candidate to trace an example by hand. A request for help gets one rung of the problem's hint ladder at a time, never beyond the next rung and never unasked; the reply returns a structured hint level (forced single tool call with a strict schema, validated, retried once on a schema error) that is logged for grading. Before any reply is spoken, code checks it for overlap with the reference solution; above a threshold it's regenerated once, then replaced by a fallback line, and the hit is logged. Replies are capped short so small models stay in role.

**Blocked by:** 05

**Status:** done

- [x] Code snapshots ride on each said signal and appear in events.jsonl
- [x] No code feedback unless the candidate said they're done or asked about their code
- [x] Hint levels are logged, never skip a rung, and never appear unasked
- [x] The solution guard regenerates or replaces a leaking reply and logs it
- [x] Engine tests with the scripted fake model cover snapshots, hint rungs, the guard and the done path
- [x] An end-to-end test shows a hint after asking for one

Spec: `.scratch/v0-1-0/spec.md`.
