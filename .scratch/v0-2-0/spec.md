# v0.2.0: voice in and out

Status: ready-for-agent

Decisions: ADR 0022 (grilled 2026-11-03), with ADR 0019 (the check), 0021 (connections) and 0015 (the look). Research: `docs/research/14-v02-voice-engines.md`. Prototype: branch `prototype/voice-engines`, `apps/desktop/prototype-voice/` (its findings are in ADR 0022's Consequences and under Further Notes here).

## Problem Statement

A round is meant to feel like a spoken interview, but today the candidate types every turn and reads every reply. "Click to talk" only marks when they're talking; they still type what they said. The interviewer never makes a sound. Practising a coding interview this way trains the wrong skill: real interviews are out loud, explaining while thinking, hearing a question rather than rereading it.

## Solution

v0.2.0 gives the round a voice in both directions, one turn at a time:

- **Click to talk, for real.** The candidate clicks the mic or presses **Ctrl+J**, talks, and clicks or presses Ctrl+J again. While the mic captures, a red dot and "Recording" show beside it. What they said is turned into text and put in the text box, where they can fix a misheard word before pressing Enter. Typing still works. A recording stops by itself after 5 minutes.
- **Speech to text on their computer or through Deepgram.** Moonshine is downloaded the first time they use the mic; Parakeet is offered as "More accurate"; a Deepgram key is a connection, and Deepgram's models (Nova-3 first) can be picked like the interviewer's.
- **The interviewer speaks.** Its replies are read aloud by Pocket TTS on the candidate's computer, after the check has passed them, at a speed the candidate picks. The first time, the app asks whether to download the voice. Talking over the interviewer stops its voice at once.
- **Settings → Voice** holds the mic, how you talk, speech to text, the interviewer's voice, which voice and its speed.
- When voice can't work, a notice says why and how to fix it, and the round carries on by typing.

## User Stories

### Talking
1. As a candidate, I want to click the mic to start talking and click it again to stop, so that I can answer out loud.
2. As a candidate, I want Ctrl+J to start and stop talking from anywhere in the room, including the editor, so that I never leave the keyboard.
3. As a candidate, I want Ctrl+J to work the same on macOS, Windows and Linux, so that the habit carries over.
4. As a candidate, I want a red dot and "Recording" beside the mic while it captures, so that I always know when I'm being recorded.
5. As a candidate, I want the recording mark to be the only red in the app, so that it can't be mistaken for anything else.
6. As a candidate, I want what I said to land in the text box when I stop, so that I can check it.
7. As a candidate, I want to fix a misheard word in the box before sending, so that the interviewer hears what I meant.
8. As a candidate, I want Enter to send the turn as before, so that spoken and typed turns work the same way.
9. As a candidate, I want my words added after anything already in the box, so that I can mix typing and talking in one turn.
10. As a candidate, I want to see that my speech is being turned into text after I stop, so that I know to wait a moment.
11. As a candidate, I want a recording to stop by itself after 5 minutes and still put what I said in the box, so that a forgotten mic doesn't record forever.
12. As a candidate, I want my speech never shown live while I talk, so that I'm not distracted by words appearing.
13. As a candidate, I want to type a turn even when the mic is set up, so that I can spell out a name or stay quiet when I need to.
14. As a candidate, I want to stop the interviewer's voice by starting to talk, so that I'm never talked over.
15. As a candidate, I want the interviewer's cut-off line kept in full in the transcript, marked as cut off, so that I can still read what it was saying.
16. As a candidate, I want starting to talk while the interviewer is still preparing a reply to drop that reply, as it does today, so that it doesn't answer something I've moved past.

### Speech to text
17. As a candidate, I want my speech turned into text on my own computer, so that it works offline and nothing leaves my machine.
18. As a candidate, I want the first use of the mic to offer the speech model download with its size, so that I know what I'm agreeing to.
19. As a candidate, I want to see the download's progress, so that I know how long to wait.
20. As a candidate, I want a broken or incomplete download detected and not used, so that a bad file never garbles my words.
21. As a candidate, I want a "More accurate" speech model I can add, so that I can trade download size for accuracy.
22. As a candidate, I want to use Deepgram instead, with my own key, so that I can use a cloud model if my laptop is slow.
23. As a candidate, I want to add my Deepgram key from the same Add list as my model keys, so that every key lives in one place.
24. As a candidate, I want my Deepgram key checked with a short clip before it's saved, so that I find out at once if it doesn't work.
25. As a candidate, I want to pick which Deepgram model I use, Nova-3 first, so that I can choose like I do for the interviewer.
26. As a candidate, I want the Speech to text picker to list only my speech models, so that it isn't cluttered.
27. As a candidate, I want "Add a model…" in the Speech to text picker, so that I can add a local or Deepgram model from there.
28. As a candidate, I want removing my Deepgram connection to remove its models from my speech models, so that nothing points at a key that's gone.
29. As a candidate, I want my Deepgram key stored like my other keys, so that it's just as safe.

### The interviewer's voice
30. As a candidate, I want the interviewer's replies read aloud, so that the round feels like a spoken interview.
31. As a candidate, I want to be asked the first time whether to download the interviewer's voice, with its size, so that I choose.
32. As a candidate, I want saying yes to turn the voice on and saying no to keep replies as text, so that my answer sticks.
33. As a candidate, I want a switch in Settings → Voice to turn the voice on or off later, so that I can change my mind.
34. As a candidate, I want to choose from a few voices, so that I can pick one I like listening to.
35. As a candidate, I want to set the speaking speed from 0.75× to 1.5×, so that the interviewer talks at a pace that suits me.
36. As a candidate, I want a button that plays a sample line at the chosen voice and speed, so that I can hear it before a round.
37. As a candidate, I want code and maths said as words ("O of n log n", "nums at i", "ten to the ninth", "hash map", "B F S"), so that I understand what the interviewer means.
38. As a candidate, I want the transcript to keep the interviewer's words as written, so that I can read the notation.
39. As a candidate, I want the interviewer's line shown when its voice starts, so that text and speech stay together.
40. As a candidate, I want the interviewer to keep the floor exactly as long as its voice lasts, so that it doesn't seem to finish early or late.
41. As a candidate, I want the "Thinking" seconds to include the moment the voice is being prepared, so that the wait is honest.
42. As a candidate, I want nothing said that the check hasn't passed, so that no hint slips out by voice.
43. As a candidate, I want the voice to stop when the round ends, so that it doesn't keep talking on the Feedback screen.
44. As a candidate, I want the app to credit the voice model's makers, so that its licence is respected.

### Settings → Voice
45. As a candidate, I want a Voice tab in Settings, so that everything about the mic and the voice is in one place.
46. As a candidate, I want to choose which microphone to use, with my system's default first, so that a headset works.
47. As a candidate, I want "How you talk" in the Voice tab, so that it sits with the mic.
48. As a candidate, I want to see which speech models and voice are downloaded and how much space they take, so that I can manage my disk.
49. As a candidate, I want to remove a downloaded model, so that I can free the space.
50. As a candidate, I want the Voice tab to scroll inside its own area like every other tab, so that the layout holds at any window size.

### When voice can't work
51. As a candidate, I want a plain notice when the mic is blocked, with how to allow it on my system, so that I can fix it.
52. As a candidate, I want a plain notice when no microphone is found, so that I know to plug one in.
53. As a candidate, I want a plain notice when a download fails, with a way to try again, so that a flaky connection doesn't strand me.
54. As a candidate on an older Linux, I want to be told that local voice needs Ubuntu 22.04 or newer, and that Deepgram and typing still work, so that I'm not left guessing.
55. As a candidate, I want a plain notice when Deepgram rejects my key or doesn't answer, so that I know whether to fix the key or wait.
56. As a candidate, I want the round to carry on with typing whenever voice fails, so that a broken mic never ends my practice.
57. As a candidate, I want a failed turn-to-text to keep nothing half-done in the box, so that I can simply say it again.
58. As a candidate, I want a voice that fails to speak to leave the reply as text, so that I still get the interviewer's words.
59. As a candidate, I want the mic never on without the recording mark, so that I can trust the app.

### Privacy and the round's record
60. As a candidate, I want my voice never saved, so that nothing private sits on my disk.
61. As a candidate, I want my audio sent to Deepgram only when I've picked a Deepgram model, so that local means local.
62. As the owner, I want each spoken turn logged with how it was turned into text (model, time taken) and whether the candidate changed it before sending, so that I can see how well speech to text works in real rounds.
63. As the owner, I want every speech-to-text and voice failure logged with a short reason, never audio or a key, so that failures can be diagnosed.
64. As the owner, I want each spoken interviewer line logged with how long its voice lasted, so that replays show the real timing.
65. As a candidate, I want Feedback to grade a spoken turn the same as a typed one, so that the mic is never a penalty.

### Platforms
66. As a candidate on macOS, Windows or Linux, x64 or arm64, I want voice to work the same, so that my platform doesn't matter.
67. As a candidate on macOS, I want the system's microphone permission prompt to explain why the app wants the mic, so that I can decide.

## Implementation Decisions

### Seams (agreed with the owner)
- **The reader** (new, in core): one pure function from the interviewer's text to speakable text. Table-tested.
- **Deepgram as a speech connection** (providers grows): its check and its turn-to-text call, tested against a fake Deepgram on loopback.
- **The voice module in main** (new, kept free of Electron like the model chooser): turns a recording into text with the chosen speech model, turns a line into audio, downloads and checks models, and reports failures in plain words. It talks to a small **speech engine** interface (recognise, synthesise); tests use a fake engine, a temporary data folder and a fake download server on loopback. The real engine runs in a utility process and is covered by the prototype's six-target check, kept as a CI smoke test.
- **The Floor Manager** (existing): the time the interviewer holds the floor comes from the voice's real length instead of the 15-characters-a-second guess.
- **End to end** (existing Playwright set-up): a scripted fake speech engine chosen by an environment variable, like the fake model, plus Chromium's fake microphone.

### The reader
- Lives in `packages/core`; no I/O. Input: the interviewer's line as written; output: the line as the voice should say it. The transcript, the log and the check always use the written line.
- Covers: big-O ("O(n log n)", "O(n^2)", "O(1)"), powers and exponents ("10^9", "1e9", "2^k"), numbers (cardinals, ordinals, decimals, negatives, ranges like "1–3"), indexing and calls ("nums[i]", "nums[i+1]", "len(s)", "dp[i][j]"), operators and comparisons ("k = 3", "i < j", "!=", "<=", "->"), camelCase, PascalCase and snake_case names split into words, all-caps acronyms spelled out (with a short list of acronyms said as words), and inline code marks dropped.
- Never removes a word it doesn't understand: it leaves it for the voice, which makes a best guess.

### Speech engine and its utility process
- One utility process for speech, started the first time voice is used in a session and kept for the session; models load on first use and stay loaded.
- Runs sherpa-onnx-node 2.0 or later (Node-API; no rebuild). **Every call that returns audio passes `enableExternalBuffer: false`**: Electron forbids external buffers (found in the prototype).
- The speech engine interface: recognise(model, 16 kHz mono samples) → text; synthesise(voice, text) → samples and sample rate; load and unload a model. Messages carry plain typed arrays.
- The native package is not bundled into main; when packaging arrives, its platform files are unpacked from asar.
- On Linux x64 with glibc older than 2.32 the engine isn't started; local voice reports "needs Ubuntu 22.04 or newer".

### Models and downloads
- A **speech model table**, plain data like the key-provider table: id, kind (speech to text, or voice), display name, size, download address (pinned sherpa-onnx release), checksum, licence and credit. Speech to text: Moonshine v2 base (default), Parakeet TDT 0.6B v2 ("More accurate"). Voice: Pocket TTS int8.
- **Voices** are a second small table: id, display name, reference clip address, checksum, licence. Only clips we may ship: Kyutai's CC0 voice donations. Never the sample clips in sherpa-onnx's archive, and never a clip the candidate supplies.
- Downloads go to a models folder inside the data folder: to a temporary name, checksummed, unpacked, then renamed into place, so a half-download is never used. Progress is reported to the renderer; a download can be cancelled; a failed one can be retried. Deleting a model removes its folder and its entry in your models.

### Deepgram
- Deepgram joins the key-provider table as a provider of the **Speech** kind (a new kind, next to the model kinds), with its key page; its key is stored like any other.
- Its check sends a short bundled clip to the pre-recorded endpoint and expects text back. Its catalog lists Deepgram's speech-to-text models; Nova-3 is the default.
- Turn-to-text sends the finished recording once, from main (never the renderer: CORS, and the key stays in main). A one-minute limit, like model replies; failures are sorted as auth, timeout or other, as model failures already are.

### Settings
- settings.json gains: the **speech to text** slot (one of your speech models), **your speech models**, the **interviewer's voice** (on, off, or not yet asked), the chosen **voice**, the **speaking speed** (0.75–1.5 in steps of 0.25, default 1), and the chosen **microphone** (a device id, or the system default). Settings version bump with a migration that only adds defaults.
- "How you talk" stays one setting; its control moves to the Voice tab. Click to talk stays its only value in v0.2.0.
- Removing the Deepgram connection removes its models from your speech models and clears the slot if it used one.

### Recording in the renderer
- Capture uses getUserMedia with echo cancellation, noise suppression and automatic gain on, the chosen device, audio only, and an AudioWorklet that collects 16 kHz mono samples. Capture stops, and the stream's tracks end, the moment talking stops, so the mic light goes off.
- Starting and stopping still send talk-start and talk-end to the Floor Manager as today; talk-start still barges in.
- On stop, the samples go to main, which turns them into text and returns it; the renderer appends it to the text box (the box gains a way to have text put in, keeping the cursor at the end) and shows that text is on its way meanwhile. A recording stops itself at 5 minutes and goes through the same path.
- Main grants the media permission to the app's own window for audio only; on macOS it asks for microphone access first, and packaging will carry the usage description.
- The CSP gains what capture and playback need (the worklet, and audio from blob URLs), and nothing else.

### The interviewer's voice in a round
- When the voice is on, a reply that has passed the check goes through the reader, then the speech engine, before it is shown. Its line and its audio reach the renderer together; the text shows as the audio starts.
- The renderer plays the audio itself (so echo cancellation hears it), at the chosen speed with the pitch kept (Pocket TTS ignores the engine's own speed setting, found in the prototype).
- **The Floor Manager's speaking time comes from the audio**: the interviewer is given a way to learn a line's speaking time, which is the audio's length divided by the speed when the voice is on, and today's estimate when it's off. The floor is held for exactly that long.
- Synthesis time counts as preparing, so the "Thinking" seconds include it.
- Stop-speaking (barge-in) and ending the round stop playback at once. A line whose voice fails is shown as text and logged.
- Backchannels and the example lines (check-ins, time reminders, the closing line) are spoken by the same voice, through the same path.

### Settings → Voice
- A new tab after Interview: Microphone (picker, system default first), How you talk, Speech to text (your speech models, "Add a model…"), the Interviewer's voice switch, Voice (picker), Speaking speed (slider) with a button to hear a sample line, and the downloaded models with their sizes and a remove action. A credit line for the voice model sits under the voice picker.
- First-use prompts: the first time the candidate talks with no speech model, a prompt offers Moonshine's download (or their Deepgram model, if one is connected); the first round after the voice download is possible asks whether to hear the interviewer. Both remember the answer.

### Logging
- A spoken turn's said signal carries how it was turned into text: the speech model, how long it took, how long the speech was, and whether the candidate changed the text before sending. Never audio.
- Each spoken interviewer line logs its voice's length and the speed. Speech-to-text and voice failures are logged with a short reason, like failed model calls.

### Notices
- Plain notices, in the room's existing notice area, for: mic blocked (with where to allow it on this OS), no mic found, download failed (with Try again), local voice needs a newer Linux, Deepgram rejected the key, Deepgram didn't answer, and a voice that couldn't speak a line. Every one leaves typing working.

## Testing Decisions

- Good tests check behaviour from outside: what the reader returns, what the voice module saves, refuses and reports, what Deepgram is sent and how its failures are sorted, how long the Floor Manager holds the floor, and what the room and Settings show. Never prompt wording, internal calls or component structure. Deterministic: fake engine, fake clock, fake servers on loopback, Chromium's fake microphone; no network, no real models in unit or end-to-end tests.
- **Reader** (new; prior art: core's pure-function tests): a table of written → spoken pairs for every notation above; words it doesn't know pass through unchanged; the empty line and plain prose pass through.
- **Providers** (prior art: the key-provider tests and their fake servers): Deepgram's check sends only the saved key and a clip, and fails as auth on a rejected key; turn-to-text returns the text; timeouts and errors are sorted; nothing is read from the environment.
- **Voice module** (prior art: the model chooser and credential store tests): a model is used only after its checksum matches; a half-download is never used and is cleaned up; progress is reported; cancel and retry work; deleting a model removes it from your speech models; recognise and synthesise go to the engine and their failures become the right notices; the old-Linux check refuses to start the engine.
- **Floor Manager** (prior art: its tests with the fake clock): with a speaking time given, the floor is held exactly that long; with the voice off, today's estimate stands; barge-in during a spoken line still stops it.
- **Settings** (prior art: the settings and settings-file tests): the new fields' defaults, validation and migration; removing Deepgram clears its models and the slot.
- **End to end** (prior art: the talking, model-step and Model tab specs): Ctrl+J and the mic button record, show the Recording mark, and put the fake engine's text in the box; Enter sends it; talking over a spoken line cuts it off in the transcript; the 5-minute stop (with a shortened limit in test mode); the first-use download prompt with a fake download server; Settings → Voice saves every control; a blocked mic and a failed download show their notices and typing still works; adding a Deepgram connection against a fake Deepgram.
- **CI smoke test**: the prototype's utility-process check (load the engine, turn a clip into text, speak a line) runs on all six targets; the real models are downloaded only there.

## Out of Scope

- Everything in v0.2.1: speech detection (an always-open mic), Silero, Smart Turn, Deepgram Flux, the AI floor classifier, and backchannels timed by listening while the candidate talks. v0.2.1 gets its own grilling after a real spoken round.
- A cloud voice for the interviewer.
- Saving any audio, or playing the candidate's turns back.
- Grading spoken and typed turns differently.
- Voice cloning or voices from the candidate's own clips.
- Languages other than English.
- Packaging and installers (asar unpacking, the macOS microphone usage description and signing are noted above for when packaging arrives).
- Kokoro: kept only as the prototype's comparison (ADR 0022 records why its word list would have needed more work).

## Further Notes

- **Prototype results** (2026-11-03): all six targets pass the utility-process check in CI. On CI runners other than macOS x64, a 3.9 s clip became text in 0.10–0.17 s and Pocket TTS had a line ready in 0.66–0.82 s; macOS x64 was about four times slower (0.68 s and 1.8 s, with model loads up to 8 s). On the owner's laptop (Linux x64), a 17.7 s answer became text in 0.38 s (Moonshine) and 0.81 s (Parakeet), both without errors on a synthetic voice.
- **To check against real speech before calling it done**: a recording of the owner through `pnpm start --wav` in the prototype, for Moonshine's real word error.
- Docs to update alongside: GLOSSARY (connection and your models already cover speech; add nothing implementation-shaped), STATUS, and BLUEPRINT's roadmap row when it's done.
