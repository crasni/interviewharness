# Research: real-time voice and turn-taking

_Researched 2026-10-29 from search-result summaries. Items marked **[unverified]** came from memory or a single source._

## Why it matters
- **Int-Bench** (Stanford, 2026) found that LLM assistants **step in earlier and more often than humans and hand over full solutions**. Restraint has to be engineered. https://cicl.stanford.edu/publication/teo2026assistants/
- HelpNeed: proactive hints help when struggle is predicted. https://arxiv.org/pdf/2010.04124
- "Illusion of progress" (2026 workshop paper): step in when there's lots of talk but no concrete action. https://ceur-ws.org/Vol-4265/paper2.pdf
- I found no work on think-aloud-aware interviewers. **That's a gap we can fill.**

## Frameworks
- **Pipecat** (BSD-2, Python): pipeline of frames running transport → VAD → STT → turn analyzer → LLM → TTS. Interruption cancels the frames downstream. It's a server process. https://docs.pipecat.ai/overview/introduction
- **LiveKit Agents** (Python plus agents-js): built around rooms and WebRTC, so it needs a LiveKit server. https://docs.livekit.io/agents/logic/turns/turn-detector
- **TEN framework:** its license may forbid running on end-user devices **[check before use]**.
- **Vocode:** stalled since Nov 2024; avoid.
- **Micdrop:** a TypeScript alternative **[not evaluated]**.
- **Decision:** write our own small TypeScript orchestrator modelled on Pipecat (frames, cancellable LLM/TTS tasks, VAD and turn-analysis stages).

## Turn detection
- **Silero VAD v5:** runs in the renderer through `@ricky0123/vad-web` (onnxruntime-web + AudioWorklet) or in Node. https://docs.vad.ricky0123.com/user-guide/api/
- **Pipecat Smart Turn v3.x** (BSD-2):
  - About 8M params (Whisper-Tiny encoder + classifier), working on **audio only** (16 kHz, up to 8 s).
  - Runs when VAD reports silence.
  - ONNX int8 is 11 MB; about 20–36 ms on an M-series CPU.
  - Works with onnxruntime-node.
  - https://github.com/pipecat-ai/smart-turn
- **LiveKit turn detector:** a text model (Qwen2.5-0.5B, 396 MB, 50–160 ms) under a custom, non-OSI license. LiveKit claims 9.9% false cutoffs vs Deepgram Flux's 12.9% at 300 ms (vendor numbers). https://livekit.com/blog/solving-end-of-turn-detection
- **Best practice:** combine an audio-based end-of-turn probability with how complete the transcript looks, and pick a short or long silence threshold from that.

## Full duplex and backchannels
- **Moshi** (Kyutai) is full-duplex at about 200 ms, but **it can't use an arbitrary LLM**, so it's ruled out for "any model". https://arxiv.org/pdf/2410.00037v1
- **Benchmarks:** Full-Duplex-Bench v1/v1.5 (https://arxiv.org/abs/2503.04721, https://arxiv.org/html/2507.23159v3) and FD-Bench (https://arxiv.org/abs/2507.19040). ECHO **[unverified]** finds models wrongly give up the floor when the user only backchannels.
- **Backchannel prediction:** a VAP fine-tune, trained on Japanese (https://arxiv.org/abs/2410.15929). Microsoft RESPOND (2026) adds controls for backchannel intensity and turn-claim aggressiveness (https://arxiv.org/html/2603.21682v2).

## Local STT
- **sherpa-onnx-node** (Apache-2.0): an N-API addon covering streaming zipformer, Parakeet, Moonshine, VAD and **Kokoro TTS**. **The best single native dependency for Electron.**
- **Moonshine v2 Streaming:** edge-oriented; docs claim 38–59 ms; English models MIT **[unverified]**. https://arxiv.org/abs/2602.12241
- **whisper.cpp** (MIT): re-decodes a sliding window rather than truly streaming; ships as a sidecar binary.
- **faster-whisper:** needs a Python sidecar.
- **Parakeet TDT 0.6B:** very accurate; CC-BY **[unverified]**.
- **Kyutai STT:** true streaming with semantic VAD, but GPU/Rust oriented.

## Cloud STT
| Service | End-of-turn detection | Notes |
|---|---|---|
| **Deepgram Flux** | model-based, `eot_threshold` 0.5–0.9 | 260–400 ms (vendor claim); about $0.0065/min (aggregator) |
| AssemblyAI Universal-Streaming | acoustic + semantic | about $0.15/hr base |
| OpenAI gpt-4o-transcribe / Realtime | `semantic_vad` + `eagerness` | priced by tokens |
| ElevenLabs Scribe v2 RT | VAD + manual commit | about 150 ms (vendor claim) |

## TTS
- **Local:**
  - **Kokoro-82M** (Apache-2.0) through sherpa-onnx or kokoro-js.
  - Piper: the maintained fork is **GPL-3.0**.
  - Kyutai TTS needs a GPU.
- **Cloud:** Cartesia Sonic-3 (about 188 ms measured P50), ElevenLabs Flash v2.5 (about 150 ms measured), OpenAI.

## Electron audio
- Use `getUserMedia({echoCancellation, noiseSuppression, autoGainControl})`.
- **Chromium's echo cancellation only cancels audio that the same Chromium process plays → TTS must play in the renderer.** A sidecar can synthesize PCM but must not play it.
- Capture with an AudioWorklet at 16 kHz and send frames over a MessagePort to a utility process.
- Recommend headphones. Don't let barge-in trigger during the first ~300 ms of TTS.
- https://developer.chrome.com/blog/more-native-echo-cancellation/

## Chosen stacks
- **Local-first:**
  - Renderer: AudioWorklet + Chromium echo cancellation + Silero.
  - Utility process: sherpa-onnx-node (Moonshine or Parakeet for STT, Kokoro for TTS) + Smart Turn v3 via onnxruntime-node.
  - LLM: any OpenAI-compatible endpoint (Ollama etc.).
- **Cloud:** Deepgram Flux (fallback AssemblyAI) + any LLM + Cartesia or ElevenLabs Flash. Keep local Silero and Smart Turn running as an independent check.

## Floor Manager design (draft)
- Deterministic state machine. Signals are refreshed every 100–200 ms:
  - VAD state and silence length
  - Smart Turn probability
  - Transcript completeness
  - Think-aloud fillers
  - Editor activity and test runs
  - Time since progress
  - Phase and rubric
- **SILENT** is the default. Never interrupt mid-utterance.
- **BACKCHANNEL:** pre-rendered audio, never sent to the LLM. Use it when a clause ends with falling pitch, Smart Turn's probability is below about 0.5, and there's been 600–1200 ms of silence. At most one every 8–10 s.
- **ACK:** the turn has ended and the user made a statement, not a question.
- **ANSWER:** a direct question, and the turn has ended.
- **PROBE:** the turn has ended and the rubric shows a gap.
- **HINT:** only on request or after a stall (60–120 s with no new code or idea, or circular talk). Escalate nudge → question → concrete. **Never the full solution.**
- **Execution:**
  - Generate a reply speculatively while the turn is still uncertain; discard it if the user keeps talking.
  - Barge-in cancels TTS and the LLM.
  - Ignore the user's own backchannels while the AI is speaking.
  - **Log every decision with its signals** so sessions can be replayed and thresholds tuned.
