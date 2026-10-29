# InterviewHarness

**An open-source interviewer that listens.**

Mock coding and system design interviews with live voice, on any model: local, your API key, or your plan.
It stays quiet while you think, says "mm-hm" instead of lecturing, and only hints when you ask.

> Status: **planning**. No code yet. See [docs/STATUS.md](docs/STATUS.md).

## Why
Every AI tutor talks too much. Real interviewers mostly listen: they let you think, nod, probe the weak spot, and give a hint only when you're truly stuck. InterviewHarness is built around that.

## Planned
- **Coding round:** live voice, a real editor (CodeMirror), tests that actually run, a phased interviewer, a scorecard with evidence
- **System design round:** an Excalidraw whiteboard the interviewer can actually *read*
- **AI-assisted round:** practise the new Meta-style interviews where you code with an AI
- **Any model:** OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, any OpenAI-compatible server
- **Voice, local or cloud:** on-device speech (Moonshine/Parakeet + Kokoro) or Deepgram
- **Yours:** plain local files, editable prompts and interviewer personas, no account, no telemetry

## Docs
- [Blueprint](docs/BLUEPRINT.md): product, UX, architecture, roadmap
- [Decisions](docs/DECISIONS.md)
- [Research](docs/research/)

## License
Code: Apache-2.0 · Content (problems, personas): CC BY 4.0

Inspired by [LearnHarness](https://github.com/amosblomqvist/learnharness).
