# v0.0: interview room with a fake interviewer

## Problem Statement

InterviewHarness's whole bet is "an interviewer that listens": one that stays quiet while the candidate thinks, nods instead of lecturing, and knows when to speak. That is a feeling, and nobody (including the owner) can judge it from a design doc. There is no code yet, so there is nothing to click, nothing to feel, and no foundation to build v0.1 on.

## Solution

v0.0 is the first real version of the desktop app: a black-and-white Electron app with three screens (start, interview room, debrief) and a fake interviewer driven by an early Floor Manager. There is no AI and no microphone. The candidate holds Space to "talk" and types what they said; the interviewer reacts with silence, backchannels, acknowledgements, replies and phase suggestions using simple rules and lines from an example-lines file. Every decision the interviewer makes is logged with the signals behind it. The round ends in a debrief laid out like a real interviewer's written feedback, with sample text.

It is the start of the real app, not a throwaway: the scaffold, design tokens and Floor Manager carry forward into v0.1.

## User Stories

### Start screen
1. As a candidate, I want the app to open on a start screen, so that I begin a round deliberately, not by accident.
2. As a candidate, I want a clear "Start coding round" action, so that I can begin with one click or key.
3. As a candidate, I want to see the other round types (system design, AI-assisted) listed but disabled and marked as coming later, so that I know what the app will grow into.
4. As a candidate, I want to start a round from the keyboard, so that the app feels keyboard-first.

### Interview room: layout
5. As a candidate, I want a top bar showing the round type, the current phase, and the elapsed time, so that I always know where I am.
6. As a candidate, I want the problem statement in a collapsible left panel, so that I can read it and then give the editor more space.
7. As a candidate, I want a real code editor (CodeMirror, mono font, black-and-white theme), so that writing code feels like the real thing.
8. As a candidate, I want the interviewer shown as a presence dot, not a face or chat bubble, so that the room feels like a room and not a chat.
9. As a candidate, I want a subtitle strip under the editor showing what the interviewer is saying, so that I can follow without audio.
10. As a candidate, I want my own words shown dimmed in the subtitle area as I "say" them, so that I can see what the interviewer heard.
11. As a candidate, I want subtitles to fade after a while, so that old lines don't clutter the room.
12. As a candidate, I want a transcript drawer I can open with a shortcut, so that I can reread the whole conversation.
13. As a candidate, I want no hint counter, score, or budget anywhere in the room, so that it feels like a mock interview and not a game.
14. As a candidate, I want the whole room in strict black and white with hierarchy from type and space, so that nothing distracts from the problem.

### Interview room: talking without a microphone
15. As a candidate, I want to hold Space to "talk", so that I can feel the timing of my own turns, pauses and the interviewer's reactions.
16. As a candidate, I want a visible state change while Space is held, so that I know the interviewer is "hearing" me.
17. As a candidate, I want to type what I said into a text input, so that the interviewer knows the content of my turn.
18. As a candidate, I want a typed line ending in "?" to count as a question to the interviewer, so that I can ask clarifying questions.
19. As a candidate, I want Space not to trigger "talk" while my focus is in the editor or text input, so that typing code and text still works.
20. As a candidate, I want to be able to "talk" again while the interviewer is speaking and have it stop (barge-in), so that I'm never talked over.

### Interviewer behaviour (early Floor Manager)
21. As a candidate, I want the interviewer to stay silent while I'm mid-turn and making progress, so that I can think aloud without interruption.
22. As a candidate, I want a backchannel (the dot nods, a short "mm-hm" subtitle) when I pause briefly mid-turn, so that I know it's listening without it taking the floor.
23. As a candidate, I want backchannels to be rare (no more than one every several seconds), so that they don't become a tic.
24. As a candidate, I want an acknowledgement after my turn ends ("Okay, that makes sense"), so that a statement doesn't fall into dead silence.
25. As a candidate, I want a reply when I ask a question and my turn has ended, so that clarifying questions get answered.
26. As a candidate, I want the interviewer never to start speaking while I'm holding Space, so that it never interrupts me mid-utterance.
27. As a candidate, I want the presence dot to breathe while listening, nod on a backchannel, and show a speaking state while it talks, so that I can read its state at a glance.
28. As a candidate, I want the interviewer to open the round with a short intro and explain the format, so that it feels like a real interview.
29. As a candidate, I want the interviewer to wrap up with "any questions for me?", so that the round ends like a real one.
30. As a candidate, I want the interviewer's lines to vary rather than repeat the same sentence, so that it feels less robotic.

### Phases
31. As a candidate, I want the coding round to run through Clarify, Approach, Code, Test, Complexity, and Wrap-up, so that it mirrors a real coding interview.
32. As a candidate, I want the interviewer to suggest moving to the next phase ("Want to start coding?") when a phase has run past its share of time, so that I don't run out of time unknowingly.
33. As a candidate, I want the interviewer to suggest moving on when I seem done (a long pause after finishing, or saying something like "I think that's it"), so that the round flows.
34. As a candidate, I want to be able to accept a phase suggestion, so that the round moves forward.
35. As a candidate, I want to be able to decline a phase suggestion and keep going, so that I'm never forced past a phase.
36. As a candidate, I want the interviewer to wait after I decline and only suggest again later, so that it doesn't nag.
37. As a candidate, I want the top bar's phase indicator to update when we move on, so that I always know the phase.

### Problem and content
38. As a candidate, I want one original problem (not LeetCode text) in the room, so that v0.0 shows a realistic round without copyright issues.
39. As the owner, I want the problem to be a plain file, so that I can review and edit it without touching code.
40. As the owner, I want the interviewer's example lines to be a plain file grouped by situation (backchannel, acknowledgement, reply, phase suggestion, intro, wrap-up), so that I can tune tone without code.
41. As the owner, I want the example-lines file to be usable later as tone guidance for the AI interviewer, so that v0.0's work carries forward.

### Logging
42. As the owner, I want every Floor Manager decision written to an events.jsonl log with the signals that led to it, so that rounds can be replayed and the rules tuned.
43. As the owner, I want silent decisions logged too where a decision was actually evaluated, so that I can see why it stayed quiet.
44. As the owner, I want one log file per round, so that rounds are easy to find and compare.

### Debrief
45. As a candidate, I want a debrief screen after the round, so that I get feedback like after a real interview.
46. As a candidate, I want the debrief to show a verdict on the six-level scale (Strong hire to Strong no hire) with reasons, so that I know where I stand.
47. As a candidate, I want "what went well" and "what to fix" sections, each point tied to a moment in the round, so that feedback is concrete.
48. As a candidate, I want no charts, stat tiles, or metric clutter in the debrief, so that it reads like an interviewer's notes.
49. As a candidate, I want the v0.0 debrief text clearly marked as sample text, so that I'm not misled before real grading exists.
50. As a candidate, I want to get back to the start screen from the debrief, so that I can start another round.
51. As a candidate, I want to be able to end the round early from the room, so that I can stop without waiting for the clock.

### Developer foundation
52. As the owner, I want the monorepo set up with pnpm workspaces and Turborepo, so that packages build and test together.
53. As the owner, I want only the packages v0.0 needs (the desktop app, core, engine), so that the repo isn't full of empty folders.
54. As the owner, I want the layering rule (core ← engine ← app) enforced by lint, so that the Floor Manager stays free of UI and I/O.
55. As the owner, I want the engine to run in the main process and talk to the renderer over IPC only, with no local HTTP port, so that the architecture matches the blueprint from day one.
56. As the owner, I want design tokens (type scale, spacing on a 4 px grid, black/white, one signal colour) defined once, so that every later screen reuses them.

## Implementation Decisions

- **Scope of the scaffold:** Electron + Vite + React + TypeScript, pnpm workspaces + Turborepo. Packages: the desktop app, `core` (pure domain types: round, phase, decision, signal), and `engine` (Floor Manager and phase logic). Other blueprint packages are added when their version needs them.
- **Process model:** the engine runs in the Electron main process. The renderer sends signals over IPC and receives decisions/lines to display. No local HTTP port.
- **Floor Manager interface (the main seam):** a deterministic module that takes a stream of timestamped signals and returns decisions. Time comes from an injected clock, never the wall clock, so tests are deterministic.
  - Signals in v0.0: talk started / talk ended (Space), typed utterance (text, with "is question" derived from a trailing `?`), editor activity, clock tick, candidate's answer to a phase suggestion.
  - Decisions: silent, backchannel, ACK (acknowledgement), answer, phase suggestion, advance phase, plus intro and wrap-up lines. `ACK` keeps its short code name by the owner's choice; prose and UI say "acknowledgement".
  - Rules: never speak while the candidate is talking; backchannel on a short mid-turn pause, rate-limited; acknowledgement or answer only after the turn ends; phase suggestion when a phase exceeds its time share or the candidate seems done; never advance a phase without the candidate's agreement.
  - Rule thresholds (pause lengths, backchannel rate, phase time shares) are fixed defaults in the engine. No persona knobs (ADR 0014).
- **What the interviewer says:** lines are chosen from the example-lines file by situation, avoiding immediate repeats. No LLM in v0.0. The file format must also work as tone guidance for an LLM in v0.1.
- **Problem:** one original problem stored as a plain file (content license CC BY 4.0). Drafted for owner review.
- **Logging:** one events.jsonl per round. Each Floor Manager evaluation writes the decision plus the signals and state it was based on. Logging sits behind an injected writer so the engine stays free of file I/O.
- **Hints:** not shown anywhere in the UI. v0.0 has no hint decision rules beyond what's listed; hints come with the AI interviewer.
- **Debrief:** sample content in the final layout (verdict with reasons, went well, to fix, each point linked to a moment). No metrics.
- **Visual design:** strict black and white, hierarchy by type weight/size/space, state by inversion, one signal colour for "recording". Grotesk UI font, mono for code. No gradients, glass, or stock component-library look.
- **Talk modes in v0.0:** hold Space and typing only. Open mic and real audio wait for v0.2.

## Testing Decisions

- **Good tests check behaviour through the seam, not internals:** feed signals, assert decisions and log entries. No assertions on private state or rule implementation.
- **Seam 1: Floor Manager (engine).** Deterministic unit/integration tests with a fake clock and a fake log writer. Scenarios include: silence while talking; backchannel after a short pause, and rate limiting; acknowledgement vs answer depending on a question; never speaking during talk; phase suggestion on time overrun and on "seems done"; declining a suggestion keeps the phase and delays the next suggestion; every evaluation is logged with its signals.
- **Seam 2: interview room (UI).** Playwright driving the Electron app: start a coding round from the start screen, hold Space and see the listening state, release and see a backchannel/acknowledgement, type a question and see an answer subtitle, accept a phase suggestion and see the phase indicator change, end the round and land on the debrief. The engine runs for real here with a controllable clock where needed; no network.
- **Prior art:** none in this repo yet. These become the reference tests for later versions.
- **No network in tests,** per AGENTS.md.

## Out of Scope

- Any LLM or provider integration, API keys, safeStorage.
- Microphone, VAD, speech-to-text, text-to-speech, open-mic mode.
- Running code (Pyodide/QuickJS runner) and test results.
- Real grading; the debrief text is sample content.
- Personas or interviewer settings (ADR 0014); level picker.
- System design and AI-assisted rounds (shown disabled on the start screen only).
- Settings screen, ⌘K palette, replay timeline, session history.
- Packages beyond the desktop app, core and engine.
- Signed builds and installers.

## Further Notes

- Glossary terms used here are defined in GLOSSARY.md: round, phase, interviewer, candidate, turn, Floor Manager, backchannel, acknowledgement, hint, debrief, verdict.
- This merges STATUS.md steps 2 (prototype) and 3 (scaffold): v0.0 is built inside the real scaffold.
- The owner wants to handcraft the Floor Manager rules and the design system; tickets for those should be `ready-for-human`, boilerplate `ready-for-agent`.
