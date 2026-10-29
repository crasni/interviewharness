# 04: The AI writes the interviewer's words (scripted fake model)

**What to build:** The tracer bullet for the AI interviewer. The engine defines a small **model interface** (purpose, system prompt, messages, optional schema; streams text or returns a structured object; supports abort; reports model identity, token use and typed errors). A **scripted fake model** implements it for tests. The Floor Manager still decides *whether* and *when* to speak with its keyword rules; for every spoken decision (intro, answer, acknowledgement, phase suggestion, move on) the model now writes the words, while backchannels stay instant lines from the lines file. Words arrive after the decision: the interviewer holds the floor in a quiet **preparing** state shown in the room, and how long it speaks is worked out from the words once they arrive. Barge-in during preparing or speaking aborts the request; a late reply is dropped and logged. A failed or slow model gives the fallback line for that kind of decision and a small notice in the room. The prompt is rebuilt from state each turn (rules, problem statement, phase, a compact recent transcript, the decided kind of reply, the lines file as tone guidance). The desktop app runs on the scripted fake model when started with an environment switch, which is how the end-to-end tests drive it.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The engine owns the model interface and depends on no provider; the scripted fake model lives with the engine's test fakes
- [x] Every spoken decision gets model-written words; backchannels never wait on the model
- [x] A preparing state is visible in the room while words are on their way
- [x] Talking over the interviewer while it prepares or speaks aborts the request and stops it at once; a late reply is dropped and logged
- [x] A model error or timeout gives the fallback line and a small notice, and the error type is logged
- [x] events.jsonl records each model reply with its model, timing and outcome, and never any credential
- [x] Engine tests with a fake clock and the scripted fake model cover all of the above
- [x] An end-to-end test with the fake model switched in shows a scripted answer to a question in the room

Spec: `.scratch/v0-1/spec.md`.
