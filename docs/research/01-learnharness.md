# Research: LearnHarness (our inspiration)

_Researched 2026-10-29 by cloning the repo at commit 3dd5211 (v0.3.9, Oct 28 2026) and reading the code. To re-inspect, run `git clone https://github.com/amosblomqvist/learnharness`._

- **What:** an open-source desktop "agent harness for learning difficult things" by Amos Blomqvist. https://github.com/amosblomqvist/learnharness · https://learnharness.ai
- **Traction:** created 2026-10-16. By 2026-10-29 it had 3,514★, 547 forks and 206 open issues, and had trended on GitHub. No HN/Reddit launch threads were found.
- **License:** **AGPL-3.0**. We are Apache-2.0, so **learn from its design but don't copy its code.**

## Stack
- Electron (thin shell) + **Next.js 16** + React + Tailwind 4 + radix-ui. Also cmdk, lucide, motion, Rive, next-themes. Markdown via `streamdown` (code, math, mermaid, CJK) + KaTeX.
- **LLM layer: `@earendil-works/pi-ai` + `pi-agent-core` 1.4.0.** That is where the "30+ providers" come from. It does **not** use the Vercel AI SDK; pi events are converted to AI-SDK-style SSE.
- Graphs: d3-force, d3-zoom, dagre, @xyflow/react. Validation: zod and typebox. No state library.
- Agent extras: puppeteer-core (verifies generated demos), react-jsx-parser (interactive demos), pdfjs, Readability, linkedom and turndown (web fetch).
- Tests: 188 files on `node:test` + tsx. **Deterministic, no LLM, no network.** Fake engines are scripted.

## Architecture
- `src/core/` holds the pure domain with no I/O: contracts, ports, plan tree, phases, prices, compaction.
- `src/agent/` holds agents, tools, prompt fragments and sub-agents.
- `src/server/` holds composition roots, keys, pricing and the SSE bridge.
- `src/store/` holds the filesystem adapters, the only code that writes data.
- `app/` has about 28 Next API routes; `components/` holds the UI.
- **ESLint enforces the layer import rules.**
- **Agents:**
  - The **Prober** handles "measure". It quizzes the user and calls `probe_done`.
  - The server then builds the **Teacher** instead, on the same transcript, so the user never sees the handover. The Teacher has plan/quiz/explain/recall, file, web, PDF and graph tools, plus background jobs: research, demo, visual.
  - **Practice** is a separate session kind with two tools, `problem` and `conclude`. **The model commits a hidden solution before posing the problem**, and gives one hint step per request.
- **Prompts are numbered Markdown fragments** (`prompts/{prober,teacher,practice}/NN-*.md` plus `shared/`), combined in filename order. Users can override any fragment from Settings.
- **Model slots:** strong, cheap and vision. There are no default models; if none are configured the app returns `models_not_configured`. Background roles use the cheap or vision slot.
- **`skills/learnharness/`** is an Agent Skill for *external* agents (Claude Code etc.) to analyse the user's data. The app's own agents don't use it. **`AGENTS.md`** sets rules for coding agents working on the repo ("No guessing", ask the human).

## Voice
- **Dictation only. No TTS, no turn-taking.** That leaves our space open.
- The server mints a short-lived Deepgram token (`/v1/auth/grant`, 300 s), so the key never reaches the renderer.
- Audio is captured in an AudioWorklet (16 kHz linear16) and streamed straight to Deepgram nova-3 (endpointing=300, no interim results). Text is inserted when dictation stops.
- Latency tricks: frames are queued rather than dropped before the socket opens, the handshake runs in parallel with mic setup, one shared AudioContext, a token minted in advance, and a generation counter against stale sessions.

## Storage
Everything sits under `userData/data`, written synchronously with read-modify-write:
- `chats/<id>.json` per session
- `graph/*.jsonl`: append-only ledgers
- `jobs/*.json`
- `settings.json`: stores only differences from defaults
- `prompts/` overrides
- `format.json`: version stamp

Keys live in plaintext `auth.json` (mode 0600) and are copied into `process.env`.

## UI
- Dark-first theme with the author's own hex values (#141414 / #1C1C1C / #434343).
- Fonts: JetBrains Mono for interface chrome, Source Sans 3 for prose, CMU Serif for titles.
- Strict 4 px grid, a defined type scale, no focus outlines anywhere.
- The knowledge graph is the home page; a session is the "classroom". Question dock with thinking fields and a confidence rail, plan window, activity dock, live cost bar, keyboard shortcuts.

## Weaknesses (from its issue tracker), our opportunities
- **Local and custom models are the #1 request:** Ollama, OpenAI-compatible, Bedrock, Azure (#21, #29, #225, #7, #30, #153, #215, #256, #217).
- **Security:** keys in plaintext; the `read` tool can read `auth.json` (#143, #97, #98).
- **Context and cost bugs:** compaction growing context from 150k to 296k (#160); 5-minute cache lifetime (#162); OpenRouter cost shown at half (#232); ChatGPT limits (#254, #255).
- **Reliability:**
  - silent submit failures (#265)
  - no retry or regenerate (#110, #122, #137)
  - stuck teaching (#167)
  - hangs (#279)
  - flicker (#191)
  - lost input when switching views (#264)
  - a **random port wiping localStorage** (#186)
- **Packaging:** Linux AppImage, .deb and launcher breakage (#242, #277, #84); no RPM, Intel Mac or Homebrew builds.
- **Voice:** English-only until 0.3.9; people want local Whisper (#15, #31) and ElevenLabs (#189).
- **Product:**
  - mobile apps (#119, #145, #230)
  - one graph per subject (#71, #207)
  - spaced repetition and Anki export (#11, #33, #262)
  - multiple-choice answers given away by their length (#221)
  - merging teaching and practice into one loop (#158)
  - over-long lines on wide screens (#136)

## Adopt
- pi-ai (providers, thinking-level clamping, cost) and model slots
- Tools as protocol: commit a hidden solution or rubric before asking; explicit handover tools (probe → interview → debrief)
- User-editable numbered prompt fragments
- Plain JSON/JSONL storage with a version stamp and one writer per store
- A skill for external agents and an `AGENTS.md`
- Deterministic tests against a fake engine
- The Deepgram token-minting pattern

## Do differently
- Real-time voice: interim results, turn-taking, barge-in, TTS
- `safeStorage` for keys
- Sandboxed tools
- Ollama and OpenAI-compatible endpoints from day one
- Tight context budgets
- **IPC instead of a Next server on a random port** (Vite, not Next)
- Retry and regenerate as first-class features
- Smaller scope and fewer docs
