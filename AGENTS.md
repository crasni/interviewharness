# InterviewHarness: notes for AI coding agents

**Read this first, then `docs/STATUS.md` (where we are and what's next).**

## What this is
An open-source (Apache-2.0) desktop app for **live voice mock CS interviews**: coding first, system design second, a Meta-style AI-assisted round later. It runs on **any model**: API keys, local (Ollama / OpenAI-compatible), and plan logins where allowed.

**Thesis: "an interviewer that listens."** Silence is the default. It acknowledges ("mm-hm") instead of lecturing, never hints unasked, and knows when to speak. The core piece is the **Floor Manager**, which decides *whether* to speak, separately from the LLM that decides *what* to say.

Inspired by [LearnHarness](https://github.com/amosblomqvist/learnharness) (AGPL). **Learn from its design; never copy its code.**

## Owner
- A CS student building this out of a passion for making things and to have real open-source impact. Not a business; no enterprise plans.
- Wants to **handcraft the interesting parts** (Floor Manager, audio pipeline, scene→graph, sandbox, design system) and let AI write the boilerplate. Explain design decisions; don't just dump code.
- **Design taste:** monochrome, modern, very clean, intuitive. Current identity is "Editorial" (ADR 0015): Newsreader + Mona Sans + JetBrains Mono on a stone neutral, soft corners, light and dark. **No AI slop:** no gradients, glass, ✨ or stock-shadcn look. Hierarchy comes from type, weight and space; the one primary action is solid ink. All styling goes through the role tokens in `apps/desktop/src/renderer/src/ui/tokens.css`.
- Names and UI copy must be **intuitive and literal**, not clever metaphors.

## Decided stack (see docs/DECISIONS.md)
- Electron + **Vite** + React + TypeScript. **No Next.js, no local HTTP port**; use IPC.
- LLM layer: pi-ai (`@earendil-works/pi-ai`, license TBD), falling back to Vercel AI SDK v6. One OpenAI-compatible adapter for local servers.
- Keys: Electron `safeStorage` only; warn on the Linux `basic_text` backend.
- Editor: CodeMirror 6. Whiteboard: Excalidraw (not tldraw).
- Voice:
  - Renderer: AudioWorklet + Silero VAD; **TTS must play in the renderer** (echo cancellation).
  - Utility process: sherpa-onnx-node (local STT and Kokoro TTS) + Smart Turn v3.
  - Cloud: Deepgram Flux.
- Code runner: Pyodide/QuickJS (WASM) plus native toolchains in an OS sandbox. No Judge0.
- Plan logins: ChatGPT only through OpenAI's official partner program. **Never use Claude consumer OAuth**; the only option is spawning the user's own `claude` CLI.

## Rules
- Layering: `packages/core` (pure, no I/O) ← `engine` ← `providers|voice|runner` ← `apps/desktop`. Enforce with lint.
- Tests are deterministic, using a scripted fake LLM and fake audio. No network in tests.
- Every interviewer decision is logged with its signals (`events.jsonl`) so sessions can be replayed and evaluated.
- Content (problems, personas) is plain files; content license is CC BY 4.0. **No LeetCode text.**
- Ask the owner before making product or design decisions that aren't in `docs/DECISIONS.md` or `docs/adr/`.

## Map
- `docs/STATUS.md`: current state, next steps, open questions
- `docs/BLUEPRINT.md`: full product and architecture plan (thesis, Floor Manager, UX, repo layout, roadmap)
- `docs/DECISIONS.md`: decision log with reasons
- `docs/research/`: market, LearnHarness teardown, voice, providers, building blocks, naming

## Agent skills

### Issue tracker
Local markdown under `.scratch/<feature>/` for the owner's work; GitHub Issues only for community reports. See `docs/agents/issue-tracker.md`.

### Triage labels
The five default roles, written as a `Status:` line in each `.scratch/` ticket. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context: `GLOSSARY.md` at the root plus `docs/adr/`; D1–D13 stay in `docs/DECISIONS.md`. See `docs/agents/domain.md`.
