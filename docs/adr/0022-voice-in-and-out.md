# Voice in and out (v0.2.0)

The blueprint's v0.2 put all of voice in one release: the mic, the interviewer's voice, and listening while the candidate talks (speech detection, backchannels, end-of-turn detection, the AI floor classifier). The owner split it on 2026-11-03 after a grilling, with the engine facts in `docs/research/14-v02-voice-engines.md`. **v0.2.0** is the candidate's voice going in and the interviewer's voice coming out. **v0.2.1** is listening while they talk; it gets its own grilling once a real spoken round has been played.

## The decisions
- **Click to talk only.** Click the mic, or press **Ctrl+J** on every OS, to start and again to stop; a recording stops on its own after 5 minutes. Ctrl+J is free in the editor, the app and all three OSes (Ctrl+D selects the next match in the editor, and moves the cursor on macOS). Speech detection waits for v0.2.1, where turns end on their own.
- **Fix, then send.** When the candidate stops, their speech is transcribed all at once and put in the text box to correct, then sent with Enter. It is never shown live. Typing stays available. (Considered: sending as said, like a real interview.)
- **Speech to text on the candidate's computer and through Deepgram, both in v0.2.0.** Locally, Moonshine v2 base by default and Parakeet TDT 0.6B v2 offered as "More accurate". Deepgram's models can be picked like the interviewer's, starting with Nova-3 on one finished recording; Flux streaming waits for v0.2.1. A Deepgram key is a **connection** of the Speech kind (ADR 0021), and speech models join **your models**: adding a local one downloads it, adding a cloud one checks it with a short clip.
- **The interviewer speaks with a local voice, chosen by ear.** Kokoro or Pocket TTS, both through sherpa-onnx; the prototype plays the same interview lines through each and the owner picks. The first time, the app asks whether to download the voice: yes turns it on, no keeps it off, and a switch changes that later. A few voices to choose from. It speaks only after the reply has passed the check (ADR 0019). No cloud voice for now.
- **Our own reader in front of the voice.** A pure, tested function in `packages/core` turns the interviewer's text into words a voice can say ("O(n^2)", "nums[i]", "1e9", "HashMap"). No engine reads interview notation well, and Kokoro in sherpa-onnx 2.0 silently drops any word it doesn't know, so the reader guarantees nothing is dropped: a word the voice doesn't know is split, spelled out or found in our own list. The transcript keeps the original words.
- **Licence-clean only.** sherpa-onnx 2.0 or later, which dropped GPL espeak-ng. Not 1.13.x with espeak-ng, and not kokoro-js or phonemizer.js, which wrap it.
- **Where it runs.** Mic capture and voice playback in the renderer, so Chromium's echo cancellation hears the voice. The speech models in a utility process (sherpa-onnx-node, a Node-API addon unpacked from asar), sending audio back over a MessagePort. Deepgram in the main or utility process, so the key never reaches the renderer.
- **Models download when first needed**, with progress and a checksum, into the data folder. The installer stays small.
- **No audio is kept.** A round saves the text and when the candidate spoke, never their voice.
- **When voice can't work** (the mic is blocked, a download failed, Deepgram doesn't answer), a notice says why and how to fix it, and the round carries on with typing.
- **Feedback grades spoken and typed turns the same.** Telling them apart may come later.
- **Settings → Voice**, a new tab: the mic, speech to text, the interviewer's voice on or off and which voice. "How you talk" moves there from Interview.
- **The recording mark** (v0.0's Q6): a red dot and "Recording" beside the mic while it captures, the one red in the app (`--recording`).
- **Talking over the interviewer stops its voice at once**; its full words stay in the transcript, marked as cut off.

## Consequences
- **Local voice needs glibc 2.32 on Linux x64** (Ubuntu 22.04+, Debian 12+): sherpa-onnx's prebuilt addon won't load on older systems, which get the usual notice and keep Deepgram and typing. Building our own addon was rejected as upkeep.
- **A prototype comes before the spec**: the engine loading in a utility process on all three OSes in CI, how long a 10-second answer takes to come back, and the two voices reading interview lines.
