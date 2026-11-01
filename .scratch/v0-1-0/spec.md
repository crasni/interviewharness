# v0.1.0: a real AI interviewer

Status: done (2026-11-01: tickets 01–12 done, CI green on macOS, Windows and Linux)

## Problem Statement

v0.0 gave the candidate a convincing interview room, but the interviewer in it is fake. It says lines from a file in turn, answers every question with the same generic replies, can't read the candidate's code, and ends the round with sample feedback that has nothing to do with what happened. The candidate can feel the timing of an interviewer that listens, but not a real conversation. The owner can't practise with it, can't judge whether "an interviewer that listens" works with a real model, and has no foundation for the mic (v0.2).

The candidate also has no way to bring their own model. They can't log in with the ChatGPT plan they already pay for, use the local Ollama models they have installed, or paste an API key.

## Solution

v0.1.0 puts a real model behind the interviewer, while keeping the Floor Manager in charge of *whether* to speak:

- **Pick a model once.** On first launch, the Start screen asks for a model with one short step: **Continue with ChatGPT** (the candidate's plan), **Ollama** (detected automatically on this machine), or an **API key**. After that, models are changed in a new **Model** tab in Settings. Logins and keys are stored encrypted by the operating system.
- **A real conversation on Two sum.** The Floor Manager still decides when the interviewer speaks, using keyword rules as in v0.0. When it decides to speak, the model writes the words: real answers to clarifying questions, short acknowledgements in the tone of the example-lines file, phase moves, and the intro. The interviewer sees the candidate's code each time they speak. It reads the code when they say they're done, and may ask them to trace an example by hand. It never hints unless asked. After a long silence it checks in once, without a hint.
- **Real Feedback.** "Debrief" is renamed **Feedback**. When the round ends, after a confirmation, the model scores four areas (problem solving, coding, testing, communication), each backed by quoted moments from the round. A fixed table turns the scores into a verdict on the six-level scale, and the candidate reads what went well and what to fix. Hints the candidate asked for lower the problem-solving score, but no counter is ever shown.
- **Everything is saved.** Each round's folder keeps the transcript, code snapshots, every decision and the Feedback, so it can be replayed. There's no history screen yet.
- **It works the same on macOS, Linux and Windows**, on x64 and arm64.

## User Stories

### Picking a model
1. As a candidate opening the app for the first time, I want the Start screen to ask me to pick a model before I can start a round, so that I never start a round that can't work.
2. As a candidate with a ChatGPT plan, I want a "Continue with ChatGPT" button that logs me in through my browser, so that I can use the plan I already pay for without an API key.
3. As a candidate, I want the ChatGPT login to come back to the app by itself once I approve it in the browser, so that I don't have to copy codes around.
4. As a candidate with Ollama installed, I want the app to find Ollama on this machine and list my installed models, so that I can pick one without typing a URL.
5. As a candidate whose Ollama isn't running, I want a plain message saying Ollama wasn't found and how to start it, so that I know what to fix.
6. As a candidate with an API key (OpenAI, Anthropic, Google or OpenRouter), I want to paste it and pick a model, so that I can use a provider I already pay for.
7. As a candidate running another local server (LM Studio, llama.cpp, vLLM), I want to enter its address as an OpenAI-compatible server, so that any local model works.
8. As a candidate, I want the app to check that the model answers before saving my choice, so that a typo or a stopped server is caught at setup, not mid-round.
9. As a candidate, I want a Model tab in Settings where I can see which model I'm using, change it, or log out, so that I'm never stuck with my first choice.
10. As a candidate, I want to optionally pick a different model for writing the Feedback, so that I can use a stronger model for grading than for the conversation.
11. As a candidate who doesn't pick a separate Feedback model, I want the interviewer's model to write the Feedback, so that one choice is enough.
12. As a candidate, I want my login and keys stored encrypted by my operating system, so that other people and programs can't read them from a file.
13. As a Linux candidate with no password safe running, I want my login saved anyway with a one-time note that it isn't encrypted on this machine, so that I can keep using the app and know the risk.
14. As a candidate, I want the app never to pick up keys from my environment variables or from other tools' logins, so that it only uses what I gave it.
15. As a candidate, I want a small local model to be clearly allowed but marked as giving rougher Feedback, so that I can practise for free and know the limits.

### The round with an AI interviewer
16. As a candidate, I want the interviewer to open the round with a short greeting in its own words, so that the start feels like a real interview.
17. As a candidate, I want my clarifying questions about Two sum answered correctly and briefly, so that I can design with the right assumptions.
18. As a candidate, I want the interviewer to answer only what I asked and not volunteer the approach, so that I do the thinking.
19. As a candidate, I want short acknowledgements after I finish a thought, in the tone of a real interviewer, so that I know I was heard without being lectured.
20. As a candidate, I want backchannels ("mm-hm") to stay instant while I talk, so that listening never lags behind me.
21. As a candidate, I want the interviewer to see my current code each time I say something, so that its replies fit where I actually am.
22. As a candidate, I want the interviewer never to comment on my code unprompted while I work, so that I can code in peace.
23. As a candidate who says I'm done, I want the interviewer to read my code and react to it, so that the round moves on like a real one.
24. As a candidate whose code looks wrong, I want the interviewer to sometimes ask me to walk an example through my code, so that I find my own bug the way real interviews expect.
25. As a candidate, I want the interviewer to judge my code against the problem's reference solution without ever showing me that solution, so that its judgement is right and the answer stays mine to find.
26. As a candidate who asks for a hint, I want one small step at a time (a nudge first, then a question, then something concrete), so that I get unstuck without being handed the answer.
27. As a candidate, I want the interviewer never to give a hint I didn't ask for, so that every idea in the round is mine.
28. As a candidate who has been silent and idle for a few minutes, I want one neutral check-in ("Want to talk me through where you are?"), so that I'm not left stranded, without it turning into a hint.
29. As a candidate, I want at most one check-in per stretch of silence, so that the interviewer doesn't nag.
30. As a candidate, I want phase suggestions and moves ("Shall we talk about complexity?") phrased naturally for this round, so that the structure feels human.
31. As a candidate, I want to talk over the interviewer and have it stop at once, as in v0.0, so that I'm never talked over, even while its reply is still being written.
32. As a candidate, I want a quiet sign that the interviewer is about to speak while its reply is being written, so that a short wait feels like a person thinking, not a freeze.
33. As a candidate whose model fails mid-round (offline, rate-limited, logged out), I want the round to carry on with a plain fallback line and a small notice of what went wrong, so that I don't lose the round.
34. As a candidate, I want the interviewer to keep the same voice and behaviour all round, so that it doesn't drift into a chatty assistant after a few turns.
35. As a candidate using a small local model, I want the interviewer to still follow the rules (no hints unasked, short replies), so that local practice is still realistic.

### Ending the round and Feedback
36. As a candidate, I want ending the round to ask me to confirm, so that I don't lose a round (and its Feedback) by a stray click.
37. As a candidate, I want a "Feedback" screen after the round, so that I learn how I did. (It replaces "Debrief".)
38. As a candidate, I want to see that my Feedback is being written while I wait, so that a few seconds of grading doesn't look like a hang.
39. As a candidate, I want a verdict on the six-level scale (Strong hire to Strong no hire) with a short reason, so that I know where I stand.
40. As a candidate, I want each area (problem solving, coding, testing, communication) scored, so that I know what to work on.
41. As a candidate, I want every point in the Feedback to quote or point to a real moment in the round with its time, so that I can trust it isn't made up.
42. As a candidate, I want to read what went well and what to fix, so that I know what to repeat and what to change next time.
43. As a candidate, I want the verdict to follow from the area scores in a fixed, predictable way, so that the same performance always gets the same verdict.
44. As a candidate who asked for hints, I want my problem-solving score to reflect it, as in a real interview, and the Feedback to say so in words, so that it's honest without a visible counter.
45. As a candidate whose Feedback was written by a small local model, I want it marked as rough, so that I weigh it accordingly.
46. As a candidate whose grading failed, I want a plain error and a "Try again" action, so that a network blip doesn't cost me my Feedback.
47. As a candidate, I want to start a new round from the Feedback screen, so that I can practise again right away.

### Settings and data on disk
48. As a candidate, I want my room preferences (text size, theme, transcript, language, editor options, panel sizes) kept in a settings file, so that they survive and live with the rest of the app's data.
49. As a candidate upgrading from v0.0, I want my existing preferences carried over once, so that nothing resets.
50. As a candidate, I want the app's data in a folder named "InterviewHarness" in the normal place for my OS, so that I can find it.
51. As a candidate upgrading from v0.0, I want my old data folder's contents moved into the new folder once, so that nothing is lost by the rename.
52. As a candidate, I want each round saved in its own folder with its transcript, code snapshots, decisions and Feedback, so that it can be replayed and checked later.
53. As a candidate, I want a crash or power cut never to leave the settings file half-written, so that the app always starts.

### The owner and contributors
54. As the owner, I want every interviewer decision logged with its signals, the model used, and how long the reply took, so that I can replay and evaluate rounds.
55. As the owner, I want every model call's purpose, model and timing logged without keys or tokens, so that I can debug without leaking credentials.
56. As a contributor, I want the whole round testable with a scripted fake model, so that tests are deterministic and need no network or keys.
57. As a contributor, I want Two sum stored in the new problem folder format (statement, details, interviewer notes with a hint ladder, reference solution, tests), so that the v0.1.2 problems follow a proven shape.
58. As a contributor on any OS, I want the app, its tests and its data files to behave the same on macOS, Linux and Windows, so that no platform is second-class.

## Implementation Decisions

### Layering and new modules
- A new **providers** package sits beside the planned voice and runner packages: core ← engine ← providers ← desktop. The layering lint rule and its test are extended so engine can't import providers and providers can't import desktop.
- **pi-ai** (`@earendil-works/pi-ai`, MIT) is the provider library, pinned to an exact version because it ships breaking changes in minor versions. It lives only inside the providers package, behind our own interface, so it can be swapped for AI SDK v6 without touching the engine. Record this in ADR 0016.
- The provider layer runs in Electron's **main process** for v0.1: it only waits on the network, and keys and safeStorage live there.

### The model interface (the main seam)
- The **engine** defines a small model interface that the providers package implements, and the engine never knows which provider is behind it. Roughly: given a purpose (interviewer reply, grading, Feedback prose), a system prompt, messages and an optional schema, it streams text or returns a structured object. It must support **abort** (barge-in), report token use and the model's identity, and fail with typed errors (offline, auth, rate limit, bad output).
- Structured output (grading, the hint level on a reply) is done by **forcing a single tool call with a strict schema**, because pi-ai has no structured-output API. The result is validated, and on a schema error the call is retried once with the error fed back.
- A **scripted fake model** implements the same interface for tests. It returns queued replies per purpose and records the requests it got. pi-ai's built-in fake provider may back it.

### Providers (build order)
1. **Continue with ChatGPT:** OpenAI's sign-in for open-source local apps, using pi-ai's flow (dynamic client registration, a loopback redirect, no client secret). The button text and branding follow OpenAI's guidelines. The plan route rejects `temperature`, so nothing may depend on it.
2. **Ollama:** through Ollama's **native chat API**, not its OpenAI-compatible endpoint, so we can set the context size (Ollama's default is about 4k, and it truncates silently) and turn thinking off. Models and their capabilities are discovered from Ollama's model list and model details. Default address `localhost:11434`, which can be edited.
3. **API keys:** OpenAI, Google and OpenRouter through pi-ai's providers, plus **our own Anthropic provider that accepts API keys only**. pi-ai's built-in Anthropic provider always registers the Claude consumer login, which we never use (AGENTS.md). A generic **OpenAI-compatible server** entry (custom address, optional key) covers LM Studio, llama.cpp and vLLM.
- **No ambient credentials:** pi-ai's lookup of environment variables and other tools' credential files is turned off. Only what the candidate entered in the app is used.

### Credentials
- A credential store backed by Electron's **async safeStorage** (the sync API is deprecated in Electron 45 and removed in 46). It's used only after the app is ready, and encrypted blobs are written atomically to a credentials file in the app's data folder.
- On Linux, if the selected backend is `basic_text`, save anyway with owner-only file permissions, and show a one-time note that the login isn't encrypted on this machine.
- If the keyring is "temporarily unavailable", retry. Never delete stored credentials because decryption failed.
- Keys, tokens and credential contents never reach the renderer, the logs, or a round folder.

### Model slots
- Two slots in v0.1: **interviewer** and **grader**. The grader falls back to the interviewer's model when unset. The floor classifier slot comes with the mic (v0.2).
- A model counts as **small** (Feedback marked rough) when it's local and under a size threshold, or the candidate marks it so. The exact threshold is the implementer's call. Document it next to the slots.

### settings.json and the data folder
- Set `productName` to **InterviewHarness**, so the data folder is the OS's normal app-data location plus "InterviewHarness". On first launch, if the old folder (named after the npm package) exists and the new one doesn't, **copy** its contents over before any window opens. That includes the browser storage that holds v0.0's preferences. Leave the old folder in place.
- One **settings.json** in the data folder, owned by main. It has a `version` field with migrations, and is written atomically (temp file, then rename), with retries on Windows when antivirus or indexers lock the file. A corrupt or unreadable file means defaults, plus a backup of the bad file.
- It holds room preferences (the existing Settings shape) and model choices (provider and model per slot, Ollama address). It never holds credentials.
- The renderer reads and changes settings only through a **narrow IPC surface**: get all, change some, and subscribe to changes. Main validates every change, as it already does for candidate signals.
- The first time the renderer sees an empty settings file but finds v0.0 preferences in its browser storage, it sends them to main once and clears them from browser storage.

### Interviewer behaviour
- The **Floor Manager stays in charge of whether and when to speak**, using v0.0's keyword rules (question, statement, done, accept). No LLM decides whether to speak in v0.1.
- **New Floor Manager decision: check-in.** After about 2–3 minutes with no talking, no "said" and no editor activity, while the floor is free, the interviewer checks in once with a neutral line. It doesn't check in again until the candidate has done something. It's logged like every other decision. The exact time goes in the floor rules with the others.
- **The model writes the words for every spoken decision** (intro, answer, acknowledgement, phase suggestion, move on, check-in). Backchannels stay instant lines from the lines file.
- **Words arrive after the decision.** The Floor Manager decides the kind of reply and its moment. The words are then requested from the model, and the interviewer holds the floor in a "preparing" state, shown quietly in the room, until they arrive. How long the interviewer holds the floor is worked out from the words once they're known. Barge-in during preparing or speaking **aborts** the model request and stops at once. A reply that arrives after it stopped mattering is dropped and logged.
- **The prompt is rebuilt from state on every turn** rather than replaying a growing chat, because persona drift sets in within about 8 turns. Each request includes:
  - the interviewer's fixed rules
  - the problem statement and interviewer notes
  - the full reference solution, marked never to be revealed
  - the hint ladder
  - the current phase and time in it
  - a compact recent transcript
  - the latest code snapshot
  - what kind of reply the Floor Manager decided on
  - the example-lines file as tone and length guidance
- **Code visibility:** each `said` signal carries a snapshot of the editor's code and language, which is also logged. The prompt asks for code feedback only when the candidate said they're done, or when the decided reply answers a direct question about their code. Asking the candidate to trace an example is left to the model, guided by the interviewer notes.
- **Hints:** a request for help is a question. Its reply returns a structured hint level (none, nudge, question, concrete), taken from the problem's hint ladder and never beyond the next rung. The hint level is logged for grading. No hint is ever given unasked: the prompt forbids it, and a reply that says it gave a hint without being asked is rejected.
- **Solution guard:** before any reply is spoken, code checks it for overlap with the reference solution's code, by normalised tokens or n-grams. Above a threshold it's regenerated once and then replaced with a fallback line. Hits are logged.
- **Failure fallback:** if the model fails or takes longer than a time limit, the interviewer says the fallback line for that decision kind from the lines file, the room shows a small notice, and the error is logged with its type.
- **Small models:** Ollama requests always set the context size explicitly (large enough for the prompt) and turn thinking off. No tool loops in the interviewer. Replies are capped short.

### Problem content
- **Two sum** moves to the problem folder format decided for v0.1.2: one folder per problem holding the candidate-facing statement, the problem's details (title, pattern, difficulty, license, credits), interviewer notes with a three-rung hint ladder and follow-ups, a Python reference solution, and test cases with ids (for v0.3's runner and as evidence for grading now). Content readers accept CRLF line endings. Problem names are checked against names Windows reserves and against case-only clashes.

### Feedback
- Rename **Debrief → Feedback** everywhere: UI copy, components, the screen, tests, glossary, docs. The existing feedback shape (verdict, why, went well, to fix, each point with a time) is kept and extended.
- **Confirmation on End round** (Q24): ending asks to confirm, because there's now Feedback to lose.
- **Grading pipeline**, run in main after the round ends:
  1. **Facts computed in code** from the log: phases reached and time in each, hint levels used, whether the candidate tested (moved through Test, or traced an example), the final code.
  2. **A structured grading call** to the grader slot. For each area (problem solving, coding, testing, communication) it returns a score on a four-step scale with evidence ids pointing at transcript turns. Ids that don't exist are dropped. A score with no valid evidence is lowered.
  3. **Caps in code:** hints used cap problem solving (nudge, question and concrete each lower it more). Never reaching Test caps testing.
  4. **Several samples** (three by default), taking the median per area. This stands in for low temperature, which the ChatGPT plan rejects.
  5. **A fixed table in core** maps the four area scores to the six-level verdict. It's a pure function.
  6. **One prose call** writes the why, what went well and what to fix from the scores and evidence. Each point carries the time of its evidence.
- Marked **rough** when the grader is a small model. On failure, show an error with "Try again", and keep the round's data so retrying needs nothing else.

### Saving rounds
- Each round's folder (already per round, with names that are safe on Windows) gains:
  - the transcript, kept in the events log as candidate turns and interviewer replies
  - code snapshots, carried on said signals
  - the model replies and their timing
  - a Feedback file
- No keys or tokens are ever written there. Every file is UTF-8 with LF line endings. A `.gitattributes` with `* text=auto eol=lf` is added to the repo.

## Testing Decisions

- **Good tests check behaviour from outside the module:** what the interviewer says and logs, what Feedback shows, what lands on disk. They don't check prompt wording or internal calls. Tests are deterministic, use the scripted fake model and fake clock, and need no network or keys.
- **Engine tests (most of the coverage).** These follow the existing floor-manager tests and fakes: a fake clock, a fake log, and now the scripted fake model. They cover:
  - every spoken decision gets model-written words
  - backchannels stay instant
  - barge-in aborts a pending model request and drops a late reply
  - the check-in fires once after the idle threshold and not again until activity
  - a failing or slow model gives the fallback line and logs the error
  - the solution guard replaces a leaking reply
  - hint levels are logged and never skip a rung
  - grading drops unknown evidence ids, applies the hint and testing caps, and takes the median of samples
- **Core tests:** the fixed table from area scores to verdict, including its edges.
- **End-to-end tests (Playwright, real app).** These follow the existing launch helper with a throwaway data folder and a hidden window, plus an environment switch that swaps in the scripted fake model. They cover:
  - first-run model setup blocks Start until a model is picked
  - the Settings Model tab
  - settings.json is created and v0.0 preferences are carried over
  - the data-folder copy from the old name
  - a round where questions get the scripted answers
  - the End round confirmation
  - the Feedback screen with verdict, area scores and timed points
  - the retry path when grading fails
  - existing Debrief tests are renamed to Feedback
- **Adapter tests:** the Ollama and Sign-in-with-ChatGPT adapters are tested against a fake HTTP server on loopback (never the internet), checking requests and parsing of streams, model lists, errors and the login redirect. The credential store and settings file are tested against a temp folder, including atomic writes, a corrupt file, and the `basic_text` path.
- **The layering test** is extended for the providers package.
- **CI runs the unit and end-to-end tests on macOS, Windows and Linux.**

## Out of Scope

- **v0.1.2:** the other nine original problems (Claude drafts, the owner reviews).
- **The code runner (moved to v0.3):** no Run button, no Pyodide or QuickJS.
- **The mic (v0.2):** speech detection, STT, TTS (including the browser's built-in voice), the REC mark, and the AI floor classifier.
- A history screen of past rounds. Rounds are saved but not listed.
- Personas or interviewer knobs (ADR 0014).
- Other subscription logins pi-ai offers (Copilot, Gemini CLI, and others). **The Claude consumer login is never in scope.**
- System design and AI-assisted rounds.
- Replay tooling and evals beyond logging what they'll need.

## Further Notes

- **Verdict scale:** six levels (Strong hire, Hire, Lean hire, Lean no hire, No hire, Strong no hire), as in the glossary and the code's existing `VERDICTS`. The owner confirmed this on 2026-10-30, replacing the four-level scale mentioned during grilling.
- Docs to update alongside, by `domain-modeling`:
  - ADR 0016 (pi-ai, the providers and their order, no Claude consumer login, no ambient credentials)
  - GLOSSARY: Debrief → Feedback, Hint now lowers the score, a new term for the check-in
  - BLUEPRINT roadmap (runner moves to v0.3)
  - BLUEPRINT §5.1 (Pyodide runs in a sandboxed worker, not the utility process)
  - STATUS
- Research behind this spec: `docs/research/08-v01-providers.md`, `10-v01-interviewer-and-debrief.md`. Decisions: `.scratch/v0-1-0/grilling.md`.
