# Research: "use any model" provider layer

_Researched 2026-10-29. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

## Libraries
- **pi-ai** (`@earendil-works/pi-ai`, formerly `@mariozechner/pi-ai`) [S]:
  - One interface across providers, plus model discovery, token and cost tracking, and handing a conversation between models.
  - **Subscription logins:** Codex (ChatGPT plan), GitHub Copilot, Gemini CLI, Antigravity. Any OpenAI-compatible endpoint also works.
  - LearnHarness uses it [V].
  - **TODO: confirm its license and maintainer before depending on it.**
  - https://cdn.jsdelivr.net/npm/@earendil-works/pi-ai@0.84.0/README.md
- **Vercel AI SDK v6** (`ai@6.x`) [S]:
  - One npm package per provider, `streamText` with an `Output` helper, `ToolLoopAgent`, MCP support.
  - The biggest ecosystem, **but no subscription logins**. This is our fallback.
  - https://v6.ai-sdk.dev/docs/foundations
- Cherry Studio is built on the AI SDK [S]. OpenCode takes its model catalog from models.dev [S].

## Key storage
- Use **Electron `safeStorage`** (async API); keytar is unmaintained [V].
- On Linux without a keyring, the backend is `basic_text`, meaning keys are effectively plaintext. **Detect this and warn the user or refuse to save.**
- https://electronjs.org/docs/latest/api/safe-storage

## Local models
- All the main local servers offer an OpenAI-compatible `/v1/chat/completions`, so **one adapter with a configurable `baseURL`** covers them.
- **Finding capabilities:**
  - Ollama: `/api/tags`, then `/api/show`, which returns a `capabilities` array (tools, vision, thinking).
  - LM Studio: `/api/v0/models`, which reports `tool_use`.
  - llama.cpp and vLLM: `/v1/models`.
- **Small models produce malformed tool calls** (per LM Studio's docs) [V]. Plan for it:
  - Validate arguments against the schema and retry with the error fed back.
  - Let users override capability flags by hand.
  - Fall back to JSON mode, then prompt-based tool use.

## Subscriptions (important)
- **ChatGPT plan:**
  - **Officially allowed for approved partners since 2026-09-29** ("Sign in with ChatGPT"). Launch partners include OpenCode, OpenClaw, Pi, T3, Kilo, Amp, Warp, Devin and Vercel.
  - Users set a per-app weekly cap; when it runs out, usage stops rather than switching to paid billing.
  - https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites · https://thenewstack.io/?p=22838568
  - Before that, Cline, OpenCode, OpenHands and Roo shipped unofficial Codex OAuth.
  - **Action:** apply to become a partner. Whether apps built on the pi-ai library inherit Pi's partner status is [U].
- **Claude Pro/Max: prohibited for third-party apps** [V]. Anthropic's Claude Code legal page says it "does not permit third-party developers to offer Claude.ai login… or to route requests through Free, Pro, or Max plan credentials." https://code.claude.com/docs/en/legal-and-compliance
  - The only safe route is to **detect the user's installed `claude` CLI and spawn it** (`claude -p --output-format stream-json`). Never touch their tokens.
  - Whether even that counts as "routing on behalf of users" is a grey area. Ask Anthropic before promoting it.
- **GitHub Copilot:** officially supported only in OpenCode, through a partnership [V]. https://github.blog/changelog/2026-01-16-github-copilot-now-supports-opencode/

## Model metadata and cost
- **models.dev** `https://models.dev/api.json`: capabilities, context size and cost per million tokens, including cache read and write.
- LiteLLM's price JSON and OpenRouter's `/api/v1/models` are alternatives.
- **Plan:** bundle a models.dev snapshot, refresh it in the background, and let user overrides win.
  - Compute cost from the usage numbers each provider returns.
  - Show subscription use as "plan usage", not dollars.
  - Local models cost $0.

## Interfaces (draft)
```ts
type AuthKind = 'apiKey' | 'none' | 'oauthPartner' | 'externalCli';
interface ModelCaps { tools; vision; reasoning; structuredOutput: 'native'|'json-mode'|'prompt';
  contextWindow; maxOutput?; promptCaching; streaming; }
interface LLMProvider { id; auth: AuthKind; listModels(): Promise<ModelInfo[]>;
  stream(req, signal): AsyncIterable<ChatEvent /* text|reasoning|toolCall|usage|error */>; validate(): Promise<Health>; }
interface STTProvider { id; caps:{streaming; endOfTurn; languages?}; openStream(opts): TranscriptStream; }
interface TTSProvider { id; voices(): Promise<Voice[]>; synthesize(text, opts): AsyncIterable<PCMChunk>; }
```
- **Where things run:** providers run in the Electron **main** process. The renderer only sees provider and model IDs, never keys.
- **Capabilities are resolved in priority order:** user override > live discovery > catalog > conservative default.
- **Model slots:** interviewer (strong), floor classifier (cheap/fast), grader (strong), assistant (for the AI-assisted round).
