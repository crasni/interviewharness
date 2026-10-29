# pi-ai behind our own model interface; ChatGPT plan first

D7 picked pi-ai on the condition that its license was confirmed. The repo's root LICENSE is MIT, it's actively maintained (Mario Zechner, Armin Ronacher), it has no native modules (so it builds the same on every OS), and it runs in Electron 45's main process (research: `docs/research/08-v01-providers.md`). So pi-ai is the provider library. It lives only inside `packages/providers`, behind a small model interface the engine defines, and is pinned to an exact version, because it ships breaking changes in minor versions. If it ever has to go, AI SDK v6 can replace it behind the same interface.

Providers are built in this order: **Continue with ChatGPT** (the candidate's plan), **Ollama** through its native chat API, then **API keys** (OpenAI, Google, OpenRouter, an API-key-only Anthropic provider, and a generic OpenAI-compatible server for LM Studio, llama.cpp and vLLM).

## Consequences

- **Correction to D7's ChatGPT note:** OpenAI's docs say open-source apps that run locally can use plan logins through dynamic client registration without applying. The partner interest form is only for paid or hosted apps. So "Sign in with ChatGPT" ships in v0.1, not v1.0. The plan route rejects `temperature`, so grading takes the median of several samples instead of relying on a low temperature.
- **We write our own Anthropic provider.** pi-ai's built-in one always registers the Claude Pro/Max consumer login, which we never use (AGENTS.md). Ours accepts API keys only.
- **No ambient credentials.** pi-ai's lookup of environment variables (including `ANTHROPIC_OAUTH_TOKEN`) and other tools' credential files is turned off. Only what the candidate entered in the app is used, stored with async `safeStorage`.
- **Ollama goes through its native API, not its OpenAI-compatible `/v1` endpoint.** `/v1` can't set the context size (Ollama's default is about 4k on most laptops, and longer input is cut silently) or turn thinking off.
- pi-ai has no structured-output API, so structured replies (grading, hint levels) force a single tool call with a strict schema.

## Considered options

- **AI SDK v6 as the primary:** larger ecosystem and Apache-2.0, but no subscription logins, which the owner wanted first for fast testing.
