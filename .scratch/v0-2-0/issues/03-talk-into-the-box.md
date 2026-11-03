# 03: Talk into the box

**What to build:** The first spoken turn, end to end on the candidate's computer. Clicking the mic or pressing Ctrl+J (on every OS, even in the editor) starts recording from the chosen microphone; a red dot and "Recording" (the `--recording` colour, the only red in the app) show beside the mic while it captures. Clicking or pressing Ctrl+J again stops it, the mic is released at once, a hint shows that the speech is being turned into text, and the text is appended to the text box after anything already there, cursor at the end. Enter sends it as before. A recording stops by itself after 5 minutes and goes through the same path. Talk-start and talk-end still reach the Floor Manager as today, so starting to talk still barges in. The first time the candidate talks with no speech model, a prompt offers Moonshine's download with its size; once it's in, it becomes their speech model.

Behind it: capture in the renderer (getUserMedia with echo cancellation, noise suppression and automatic gain; an AudioWorklet collecting 16 kHz mono samples); main grants the media permission to the app's own window for audio only (asking macOS for microphone access first); the CSP gains only what capture needs; the speech utility process running sherpa-onnx-node, started on first use and kept for the session, behind the **speech engine** interface (recognise, synthesise, load, unload), with `enableExternalBuffer: false` on every call that returns audio (Electron forbids external buffers, found in the prototype); the voice module's recognise path. The said signal of a spoken turn records the speech model, how long turning it into text took, how long the speech was, and whether the candidate changed the text before sending; never audio.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Click and Ctrl+J start and stop recording on macOS, Windows and Linux, including with focus in the editor and the text box; Ctrl+J's old editor meaning is not triggered
- [ ] The Recording mark shows exactly while the mic captures; the mic is released when talking stops
- [ ] The text lands in the box (appended, cursor at the end) and is sent only on Enter; speech is never shown live
- [ ] The 5-minute stop works (with a shortened limit in test mode)
- [ ] The first-use prompt offers Moonshine's download, and its answer is remembered
- [ ] The spoken turn's log fields are written; no audio is saved anywhere
- [ ] The voice module's recognise path is tested with a fake speech engine
- [ ] End to end, with a scripted fake speech engine chosen by an environment variable and Chromium's fake microphone: Ctrl+J and the mic button record, show the mark, put the fake text in the box; Enter sends it; talking over a reply still cuts it off

Spec: `.scratch/v0-2-0/spec.md`.
