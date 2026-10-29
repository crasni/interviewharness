# Decision log

Newest last. Format: **decision**, then why, then what we rejected.

### D1 · 2026-10-29 · Open source, not a business
Goal: passion for creation, real open-source impact, showing who the owner is. **Apache-2.0** for code, **CC BY 4.0** for content.
Rejected: enterprise or subscription plans; AGPL (it maximises protection, we want maximum adoption).

### D2 · 2026-10-29 · Thesis: "an interviewer that listens"
"Any model" is table stakes (LearnHarness already has it). Our signature is turn-taking: silence by default, backchannels, hints only on request, knowing when to speak. Research (Int-Bench 2026) confirms LLMs over-intervene unless constrained.
Rejected: "all-in-one interview platform" as the pitch (scope trap).

### D3 · 2026-10-29 · Scope order
v0.0 UI prototype → v0.1 coding (text) → v0.2 voice → v0.3 debrief and evals → v0.4 system design → v0.5 AI-assisted round → v1.0.
Behavioral interviews: later, maybe never.

### D4 · 2026-10-29 · Electron + Vite + React + TypeScript
Live voice needs consistent Chromium media (mic, echo cancellation, AudioWorklet). Tauri on Linux uses WebKitGTK, whose media support is weak, and the owner develops on Linux. One language means faster shipping and easier contributions. LearnHarness proves Electron is no barrier to adoption. Use IPC; **no Next.js and no local port** (LearnHarness's random-port and packaging bugs).
Rejected: Tauri (the small binary isn't worth the media risk; maybe a Rust helper later as a handcraft project), Python backend (packaging pain), fully native UI (would mean rebuilding Excalidraw and an editor).

### D5 · 2026-10-29 · Floor Manager is deterministic; the LLM only writes lines
Separate "should I speak?" (rules + signals + persona knobs, fast) from "what do I say?" (LLM). Backchannels are cached audio with no LLM call. Small local models then work acceptably.
Rejected: letting the LLM decide when to talk; full-duplex speech models like Moshi (they can't use an arbitrary LLM).

### D6 · 2026-10-29 · Voice: cascade STT → LLM → TTS
Local: Silero VAD + Smart Turn v3 + sherpa-onnx (Moonshine/Parakeet STT, Kokoro TTS). Cloud: Deepgram Flux (+ AssemblyAI), Cartesia or ElevenLabs. TTS plays in the renderer so echo cancellation works. Push-to-talk and typing are first-class fallbacks.
Rejected: dictation-only (LearnHarness's approach), Pipecat or LiveKit inside the app (server frameworks), OpenAI Realtime as the default (locks you to one provider; may become an optional mode).

### D7 · 2026-10-29 · Providers
pi-ai (once its license is confirmed), otherwise AI SDK v6. One OpenAI-compatible adapter for Ollama, LM Studio, llama.cpp and vLLM from day one (LearnHarness's top request). Model slots: interviewer, floor classifier, grader, assistant. Keys in `safeStorage`. Capabilities in priority order: user override > discovery > models.dev > defaults.
**ChatGPT plan:** only through OpenAI's official "Sign in with ChatGPT" partner program (apply). **Claude plan:** never handle its OAuth; at most spawn the user's own `claude` CLI, after confirming with Anthropic.

### D8 · 2026-10-29 · Editor: CodeMirror 6 · Whiteboard: Excalidraw
CodeMirror: small, fully themable for strict black and white, mature Vim mode, close to the CoderPad experience. Excalidraw: MIT, a complete API; we build the scene→graph converter as the standalone package `board-graph`.
Rejected: Monaco (heavy, looks like VS Code), tldraw (license key and watermark).

### D9 · 2026-10-29 · Code runner: WASM + native-in-sandbox
Pyodide and QuickJS out of the box; the user's own toolchains in bubblewrap / sandbox-exec / Job Objects; fail closed. Windows starts with WASM languages only.
Rejected: Judge0 (GPL, Docker, CVEs), Piston as the default (Docker; its API went paid).

### D10 · 2026-10-29 · Content: original problems as files
YAML + starters + hidden tests + a reference solution checked in CI. Never LeetCode text. system-design-primer (CC BY 4.0) can be used with attribution. Interviewer personas are SKILL.md-style files with knobs in the frontmatter.

### D11 · 2026-10-29 · Grading: evidence first
1–4 per axis (problem solving, coding, verification, communication; design axes for system design). Every score cites a transcript line, code snapshot or test result. Median of several samples at low temperature.

### D12 · 2026-10-29 · Name: InterviewHarness
Intuitive and unique. See `research/05-naming.md`.

### D13 · 2026-10-29 · Design language
Strict black and white; hierarchy from type, weight and space; state shown by inversion; at most one signal colour (recording). Own design tokens, not stock shadcn. Keyboard-first with ⌘K. The interviewer is a *presence* (a breathing dot, a nod, a waveform plus subtitles), never a chat bubble or a face.
