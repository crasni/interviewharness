# Research: the v0.1 provider layer

_Researched 2026-10-30. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

Goes deeper than `03-providers.md` and corrects it where noted (see "Corrections to 03"). "Tarball" below means the published npm package `@earendil-works/pi-ai@1.4.0`, unpacked and read file by file.

## 1. pi-ai (`@earendil-works/pi-ai`)

### License, maintainers, activity
- **License is MIT.** Root `LICENSE` of github.com/earendil-works/pi reads "MIT License, Copyright (c) 2025 Mario Zechner"; `package.json` says `"license": "MIT"` [V] (`gh api repos/earendil-works/pi/contents/LICENSE`, tarball `package.json`). The npm package ships no LICENSE file of its own and neither does `packages/ai/` [V]. MIT is compatible with our Apache-2.0.
- **Maintainers:** Mario Zechner (badlogic, ~4,050 commits) and Armin Ronacher (mitsuhiko, ~920) lead; npm maintainers are mitsuhiko, badlogic, rwachtler [V] (`npm view`, GitHub contributors API). Org: Earendil Works, Austria (earendil.com) [V].
- **Very active:** 118k stars, 15k forks, last push 2026-10-29, ~60 versions since 2026-05-07, 1.0.0 on 2026-10-01, 1.4.0 on 2026-10-21 [V] (npm `time`, GitHub API). Published from GitHub Actions with npm provenance [V] (npm `_npmUser.trustedPublisher`).
- **Breaking changes land in minor versions even after 1.0** (1.1.0, 1.3.0, 1.4.0 and "Unreleased" all have a "Breaking Changes" section) [V] https://github.com/earendil-works/pi/blob/main/packages/ai/CHANGELOG.md. **Pin an exact version and keep it behind our own interface.**

### API (read from the tarball's `README.md` and `dist/*.d.ts`)
- **Model registry:** `createModels()` builds a collection; `setProvider(openaiProvider())` registers one provider (subpath `providers/<id>`); `getModels()`/`getModel(provider, id)` are sync reads; `refresh()` fetches dynamic lists [V] README "Providers and Models".
  - Each model carries `api`, `baseUrl`, `reasoning`, `input` (text/image), `cost` per million, `contextWindow`, `maxTokens`, optional `compat` and `thinkingLevelMap` [V] README "createProvider()".
  - The built-in catalog is generated from **models.dev's v2 catalog** at build time [V] CHANGELOG "Unreleased › Changed". So we get models.dev data without fetching it ourselves.
  - The chat catalog lists only models that support tool calling [V] README intro.
- **Streaming:** `models.stream(model, context, options)` is an async iterable of `start`, `text_*`, `thinking_*`, `toolcall_start/delta/end`, `done`, `error`; `await s.result()` gives the final `AssistantMessage` [V] README "Quick Start". `complete()` is the non-streaming form.
- **Errors never throw after the stream is returned;** they arrive as an `error` event and `stopReason: "error"` [V] README "Error Handling".
- **Abort:** `options.signal` (AbortSignal); the result has `stopReason: "aborted"` and keeps partial content and partial usage. An aborted message can go back into the context and be continued [V] README "Aborting Requests". This fits barge-in.
- **Tool calls:**
  - Tools take TypeBox schemas (`Type.Object`), re-exported from the root [V].
  - `validateToolCall(tools, call)` validates arguments; feed the error back as an `isError` tool result so the model can retry [V] README "Validating Tool Arguments".
  - Partial tool arguments stream as `toolcall_delta` [V].
  - `constrainedSampling: { type: 'json_schema', strict: 'prefer' | 'require' }` asks for provider-side strict schemas on OpenAI, Anthropic, Bedrock, Mistral and Gemini 3 [V] README "Constrained Sampling for Tools".
- **Structured output:** there is **no `response_format` / `generateObject` API**. Use a single tool with a strict schema, or `samplingParams` (merged into the body as-is on OpenAI-compatible adapters) to send `response_format` [V] `dist/types.d.ts` (`samplingParams`, `ToolChoice = "auto" | "none"`); grep of `dist/` finds `response_format` in no adapter.
  - Forcing a tool needs the per-API option: `openai-completions` takes OpenAI's full `toolChoice`, `anthropic-messages` takes `"any"` or `{type:'tool'}` [V] `dist/api/openai-completions.d.ts`, `dist/api/anthropic-messages.d.ts`.
- **Reasoning:** `streamSimple`/`completeSimple` take `reasoning: 'minimal'|'low'|'medium'|'high'|'xhigh'|'max'`; it is ignored for non-reasoning models [V] README "Thinking/Reasoning".
  - The `openai-completions` adapter reads `reasoning_content`, `reasoning` or `reasoning_text` from stream deltas [V] `dist/api/openai-completions.js` ~l.390.
- **Token and cost tracking:** every message has `usage {input, output, cacheRead, cacheWrite, reasoning?, totalTokens, cost{…, total}}` in USD from catalog prices [V] `dist/types.d.ts` `interface Usage`.
- **Custom baseURL / Ollama:** `createProvider({ id, baseUrl, auth, models | fetchModels, api: openAICompletionsApi() })`. The README's own example is Ollama at `http://localhost:11434/v1` [V] README "createProvider()".
  - Set `compat` on Ollama and vLLM models: `supportsDeveloperRole: false` and `supportsReasoningEffort: false` [V] same section.
  - Set `maxTokensField: 'max_tokens'` too. The default is `max_completion_tokens` [V] README "OpenAI Compatibility Settings", and Ollama's request struct only has `max_tokens` [V] https://github.com/ollama/ollama/blob/main/openai/openai.go `ChatCompletionRequest`.
  - There is **no built-in Ollama provider**. We write one `createProvider` with `fetchModels` [V] (`dist/providers/` has no ollama module).
- **Test double:** `fauxProvider()` scripts text, thinking and tool-call responses, and can stream at a set `tokensPerSecond` [V] README "Faux Provider for Tests". It fits our "scripted fake LLM" rule.
- **Telemetry:** off by default (no-op span). `@earendil-works/pi-telemetry` has no exporter and makes no network calls [V] tel tarball README ("no exporter… or dependency on a telemetry backend"); grep finds no `fetch`/`http`.
- **No network at import.** Only `refresh()` of dynamic providers and OAuth flows call `fetch` [V] grep of `dist/` (only `providers/radius-config.js` and `cloudflare-ai-gateway.js` mention remote catalogs).
- **Default User-Agent is `pi/<version> (...)`.** Override it with `createModels({ identity: { userAgent: { custom: 'InterviewHarness/x' } } })` [V] README "Client Identity".
- **Ambient credentials:** by default auth reads env vars (`OPENAI_API_KEY`, **`ANTHROPIC_OAUTH_TOKEN`**, …) and files.
  - `createModels({ authContext: { env: async () => undefined, fileExists: async () => false } })` turns that off [V] `dist/auth/types.d.ts` `AuthContext`, `dist/providers/anthropic.js`.
  - `createModels({ credentials })` takes a pluggable `CredentialStore` (`read`, `list`, `modify`, `delete`); the default is in-memory [V] README "Credential Store". **Back this with safeStorage.**

### Where it runs
- **Electron main and utility processes: yes.** Both are Node.js; Electron 45.1.0 ships Node 24.22.1 [V] (`ELECTRON_RUN_AS_NODE=1 electron -e process.versions` in this repo). pi-ai needs `node >=22.19.0` [V] tarball `package.json` `engines`. Our root `engines` says `>=22`, so CI must use ≥22.19.
- **ESM only:** `exports` define only `import`/`types` [V]. Cherry Studio's CJS main bundle had to load it with dynamic `import()` [V] https://github.com/CherryHQ/cherry-studio/blob/main/src/main/ai/runtime/pi/piSdk.ts. **Our main bundle is already ESM** (`apps/desktop/package.json` `"type": "module"`, `out/main/index.js` uses `import`) [V], so static imports work.
- **Renderer: technically yes, but no.** The README supports browsers only with explicit keys and warns against it [V] README "Browser Usage". Keys stay in main (BLUEPRINT §5.1).
- **Precedent:** Cherry Studio (Electron 44) pins `@earendil-works/pi-ai` 1.4.0 next to `ai` 6.0.185 [V] https://github.com/CherryHQ/cherry-studio/blob/main/package.json. LearnHarness also uses it [V] `01-learnharness.md`.

### Size and dependencies
- **Runtime deps:** `openai`, `@anthropic-ai/sdk`, `@google/genai`, `@aws-sdk/client-bedrock-runtime`, `@smithy/node-http-handler`, `typebox`, `partial-json`, proxy agents and `pi-telemetry`, all pinned exactly [V] tarball `package.json`.
- **Install size:** the package is 4.3 MB unpacked [V] (npm `dist.unpackedSize`). The full tree is about 113 MB of `node_modules`, mostly `openai` (28 MB), `@anthropic-ai` (14 MB), `@google` (11 MB), AWS SDK and smithy (~15 MB) [V] measured in a scratch install.
- **No native modules:** no `.node` files in the tree. The only install script is `protobufjs` postinstall, a pure-JS version check [V] scratch install. **No per-platform builds needed.**
- **Bundle size:** with lazy subpath providers, SDKs load on first use [V] README "Bundling and Tree Shaking".
  - A minified single-file esbuild bundle of `models` + openai-completions + openai/anthropic/google providers is **1.41 MB** without code splitting [V] measured.
  - electron-vite externalizes `dependencies` by default (our `electron.vite.config.ts` only bundles workspace packages) [V], so the whole tree would ship. Bundling pi-ai into main instead would drop unused SDKs; not yet measured [U].

### Subscription logins inside pi-ai (read from `dist/auth/oauth/*`)
- **Built-in OAuth:** Anthropic (Claude Pro/Max), OpenAI "Sign in with ChatGPT", OpenAI Codex (legacy, reuses the Codex CLI's client id `app_EMoamEEZ73f0CkXaXp7hrann`), GitHub Copilot, OpenRouter (PKCE that mints an API key), and others (Kimi, Meta, xAI, Radius) [V] README "OAuth Providers", `dist/auth/oauth/`.
- **`anthropicProvider()` always registers the Claude Pro/Max OAuth method,** and its API-key path also accepts `ANTHROPIC_OAUTH_TOKEN` from the environment [V] `dist/providers/anthropic.js`. AGENTS.md forbids that route.
  - **Do not register the stock `anthropicProvider()`.** Build our own with `createProvider({ auth: { apiKey } })` and `anthropicMessagesApi()`. Disable ambient env as shown above.
- **Sign in with ChatGPT** (`dist/auth/oauth/openai-chatgpt.js`):
  - Uses dynamic registration: `client_id=dynamic_agent_client`, `agent_name_hint` (default "Pi"; we pass `agentName: 'InterviewHarness'`) and `ext_agent_host_id = urn:uuid:<getDeviceId()>` [V] `dist/auth/types.d.ts` `LoginOptions`.
  - Opens a loopback listener on **fixed** `127.0.0.1:1455` only during login, and fails clearly if the Codex CLI holds that port [V].
  - Does **not** check the ID token signature against JWKS (no JWKS code) [V] grep; OpenAI's guide asks clients to [V] (§6 link).
- **Allowed for us:** API keys; local/OpenAI-compatible; Sign in with ChatGPT (see §6, it is open to open-source apps).
- **Not allowed:** Claude Pro/Max OAuth [V] https://code.claude.com/docs/en/legal-and-compliance; the legacy Codex flow (borrowed client id); GitHub Copilot (partnership is with OpenCode only) [V] https://github.blog/changelog/2026-01-16-github-copilot-now-supports-opencode/.

## 2. Vercel AI SDK v6 (`ai`), briefly
- **`ai@6.0.319`, Apache-2.0** (`Copyright 2023 Vercel, Inc.`), `node >=18`, actively pushed 2026-10-29 [V] npm, https://github.com/vercel/ai/blob/main/LICENSE.
- **Has what pi-ai lacks:** `generateObject`/`streamObject` and `output` on `streamText`, `toolChoice`, `abortSignal`, `ToolLoopAgent`, `experimental_repairToolCall` [V] `ai/dist/index.d.ts`. `@ai-sdk/openai-compatible@3.0.81` covers local servers [V] npm.
- **Missing:** a model/price catalog and cost in USD (usage is tokens only), and subscription logins [V] `index.d.ts` (no cost fields); [S] for logins.
- **Verdict:** pi-ai is safe as the primary: MIT, very active, no native deps, works in Electron main (Cherry Studio and LearnHarness both ship it). Its real risks are churn (breaking minors) and the gap in structured output. Both are handled by pinning and by our own `LLMProvider` wrapper. The AI SDK stays the fallback; nothing found requires switching.

## 3. Ollama and other OpenAI-compatible servers
- **Ollama version:** v0.40.13 (2026-10-28) [V] GitHub releases API.
- **Listing:** `GET /api/tags` lists local models. `POST /api/show {model}` returns `capabilities` (e.g. `["completion","vision"]`, plus `tools`/`thinking`), `model_info["<arch>.context_length"]` and the Modelfile `parameters` [V] https://github.com/ollama/ollama/blob/main/docs/api.md "Show Model Information".
  - `/api/show` also returns `thinking: { values, default }`. `values: [false]` means no thinking [V] docs/capabilities/thinking.mdx.
  - `/v1/models` exists but carries no capabilities [V] docs/api/openai-compatibility.mdx.
- **Streaming:** both native `/api/chat` (NDJSON) and `/v1/chat/completions` (SSE, `stream_options.include_usage`) [V] same docs.
- **What `/v1/chat/completions` does NOT support:** `tool_choice`, `logprobs`, `n`, and **any way to set `num_ctx`** [V] openai-compatibility.mdx checklist and "Setting the local context size"; the `ChatCompletionRequest` struct has no `options` [V] openai/openai.go. Forcing a tool call on Ollama is therefore impossible through `/v1`.
- **Context length (the biggest trap):**
  - Current docs: the default depends on VRAM: **<24 GiB → 4k**, 24–48 GiB → 32k, ≥48 GiB → 256k. They recommend ≥64k for agents [V] docs/context-length.mdx. (The FAQ still says a flat 4096 [V] docs/faq.mdx; context-length.mdx is newer.)
  - Most laptops get **4k**, which an interviewer prompt plus problem plus transcript will overflow. pi-ai notes Ollama "may truncate input silently" [V] `dist/utils/overflow.js`.
  - Fixes: native `/api/chat` with `options.num_ctx`, the `OLLAMA_CONTEXT_LENGTH` env var or app slider, or a Modelfile `PARAMETER num_ctx` [V] context-length.mdx, faq.mdx.
- **Thinking (qwen3 etc.):**
  - Native: `think: true|false|"low"|…`; the reply carries `message.thinking` separately from `message.content` [V] thinking.mdx.
  - `/v1`: `reasoning_effort` or `reasoning.effort`, where `"none"` turns thinking off; the stream delta has a `reasoning` field [V] openai-compatibility.mdx l.253, openai.go `Reasoning string json:"reasoning"`. pi-ai reads that field (§1).
  - For the floor classifier, **turn thinking off** (latency).
- **Structured output:**
  - Native `format: "json" | <JSON schema>`; `/v1` supports `response_format` [V] api.md, openai-compatibility.mdx.
  - Ollama's tips: temperature 0, and also put the schema in the prompt "to ground the model's response" [V] docs/capabilities/structured-outputs.mdx.
  - That schema enforcement uses grammar-constrained decoding is [S] (Ollama blog, 2024).
- **Tool calls on ~8B models:** Ollama documents no reliability guarantee. LM Studio's docs say small models produce malformed calls [V per 03]. So: validate, retry with the error, fall back to `format`/`response_format` JSON [S].
- **Decision models:** Ollama ≥0.35 serves "decision" models (Nimble, Clef) that answer yes/no, choice and score questions about a state [V] docs/capabilities/decision.mdx. pi-ai has a matching `classify()` API (`llama-cpp-classify`, System One) [V] README "Classification". Worth a spike for the floor classifier; untested by us [U].
- **LM Studio:** `GET /api/v1/models` returns `capabilities.trained_for_tool_use`, `capabilities.vision`, `capabilities.reasoning`, `max_context_length`, and `loaded_instances[].config.context_length` [V] https://lmstudio.ai/docs/developer/rest/list. Examples use port 1234 [V] https://lmstudio.ai/docs/developer/rest/endpoints. (03 named `/api/v0/models … tool_use`; v1 is now recommended.)
- **llama.cpp / vLLM:** `/v1/models`. pi-ai compat flags cover their thinking params (`thinkingFormat: 'qwen-chat-template'`, `thinkingTokenBudgetField`) [V] README "OpenAI Compatibility Settings".

## 4. Electron `safeStorage` (Electron 45.1.0, our version)
- **Main process only** ("Process: Main") [V] https://github.com/electron/electron/blob/v45.1.0/docs/api/safe-storage.md. The utility process cannot use it; keys must be decrypted in main and passed per request.
- **The sync API is deprecated in 45 and "will be removed in Electron 46"** [V] same doc. 03 said "async API"; this makes it mandatory. Use:
  - `isAsyncEncryptionAvailable(): Promise<boolean>`
  - `encryptStringAsync(s): Promise<Buffer>`
  - `decryptStringAsync(buf): Promise<{ shouldReEncrypt, result }>`: if `shouldReEncrypt`, write the value again.
- **Before `ready`:** `isAsyncEncryptionAvailable()` resolves `false`; async encrypt and decrypt **reject** with "safeStorage cannot be used before app is ready" [V] https://github.com/electron/electron/blob/v45.1.0/shell/browser/api/electron_api_safe_storage.cc l.195, 263, 316, 348. `getSelectedStorageBackend()` returns `unknown` [V] doc.
- **Temporarily unavailable** (e.g. a locked keyring): decrypt rejects with "…temporarily unavailable. Please try again." [V] .cc l.150. Retry instead of deleting the key.
- **Linux backends:** `basic_text`, `gnome_libsecret`, `kwallet`, `kwallet5`, `kwallet6`, or `unknown` (before ready) [V] doc.
  - `basic_text` means "encrypted via hardcoded plaintext password" [V] doc.
  - **Detect it with `safeStorage.getSelectedStorageBackend() === 'basic_text'` after ready.** The async path checks the same `linux_storage_backend()` value [V] .cc l.184, 202.
  - The async API also supports the Flatpak `org.freedesktop.portal.Secret` [V] doc.
  - Users can force a backend with `--password-store=…` [V] doc.

## 5. `settings.json` in userData
- **Where:** `app.getPath('userData')` = `appData` + app name. `appData` is `%APPDATA%` (Windows), `$XDG_CONFIG_HOME` or `~/.config` (Linux), `~/Library/Application Support` (macOS) [V] https://github.com/electron/electron/blob/v45.1.0/docs/api/app.md. Electron prefers `productName` over `name` [V] same, `app.getName()`.
  - **We set no `productName`,** so today userData is `~/.config/@interviewharness/desktop` (a nested scoped folder) [V] observed on this machine.
  - localStorage lives in `sessionData`, which defaults to userData [V] app.md. **Adding `productName` later moves userData and strands the old localStorage.** Decide the name before migrating.
- **Atomic write (main only):**
  - Write `settings.json.tmp-<rand>` in the **same directory**, fsync, then `rename` over the target.
  - On Windows, Node's rename is `MoveFileExW(…, MOVEFILE_REPLACE_EXISTING)` [V] https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c `fs__rename`. It fails with `EPERM`/`EBUSY`/`EACCES` while another process (antivirus, indexer, sync client) has the target open.
  - graceful-fs retries only when the target does *not* exist [V] https://github.com/isaacs/node-graceful-fs/blob/main/polyfills.js l.96–123, so it does not help for overwrites.
  - `atomically` (MIT, used by `conf`/`electron-store`) retries `EPERM`/`EBUSY`/`EACCES`/`EMFILE` for up to 7.5 s and fsyncs [V] https://github.com/fabiospampinato/atomically readme; `npm view conf dependencies`. Either use it or copy the pattern: about 40 lines with retry and backoff on win32.
  - Serialize writes through one in-process queue so two `set` calls can't race.
- **Schema and migration:**
  - Store `{ "version": N, … }` with only non-default values (BLUEPRINT §5.3).
  - On load: parse; if invalid, rename to `settings.json.bad-<time>` and use defaults; then run ordered `migrations[v] → v+1`; then validate.
  - Precedents: `conf` uses semver-keyed migrations [V] npm deps (`semver`, `ajv`). OpenCode keeps a typed `ConfigMigrateV1` that maps old keys into new structures and reports "diagnostics" instead of failing [V] https://github.com/anomalyco/opencode/blob/dev/packages/core/src/config/normalize.ts.
- **IPC exposure:** follow our current pattern (`preload/index.ts` → `contextBridge.exposeInMainWorld('harness', api)` with `ipcRenderer.invoke`) [V] repo.
  - Expose narrow verbs (`getSettings()`, `updateSettings(patch)`, `onSettingsChanged(cb)`), never `ipcRenderer` itself.
  - Validate every patch in main against the schema.
  - Check `event.senderFrame` [V] electron security.md §17 "Validate the sender of all IPC messages" (v45.1.0). Since Electron's contextBridge change, `ipcRenderer` itself can no longer be sent across the bridge [V] docs/api/context-bridge.md history.
  - **Secrets never cross:** the renderer only sees `{ provider, hasKey: true }`.
- **First paint:** `settings.tsx` reads theme and text size synchronously from localStorage today [V] repo. An async IPC read would flash the wrong theme.
  - Option: main reads settings before creating the window and passes them in (e.g. `webPreferences.additionalArguments`, or one `ipcRenderer.sendSync` in preload) [U]. Decide on implementation.
- **Migrating localStorage:**
  - On the first launch with `settings.json` missing, the renderer sends its `settings` and `interviewer-tile-corner` values once through `importLegacySettings(blob)`.
  - Main validates, merges under defaults, writes, and records `migratedFrom: 'localStorage'`; the renderer then removes the keys.
  - Running it again is a no-op because the file exists. Current keys: `settings`, `interviewer-tile-corner` [V] `renderer/src/settings/settings.tsx`, `room/InterviewerTile.tsx`.

## 6. Sign in with ChatGPT for open-source apps (correction to 03)
- **OpenAI's docs:** "ChatGPT plan usage is available to all open-source partners and selected private clients." The open-source flow "registers your client and issues OAuth credentials … without a client secret or partner API key" [V] https://developers.openai.com/siwc/quickstart.md.
  - **The interest form is only for "a paid or remotely hosted app"** [V] https://developers.openai.com/siwc/token-sharing-open-source.md. InterviewHarness is open source and runs locally, so **no application seems needed**. Whether we count as an "open-source partner" without any sign-up is [U]; ask OpenAI or read their terms.
- **Flow:** first sign-in uses `client_id=dynamic_agent_client`, our real name as `agent_name_hint`, and a stable per-install `ext_agent_host_id` (`urn:uuid:…` allowed); save the issued `oaiapp_…` client id [V] https://developers.openai.com/siwc/token-sharing-open-source/sign-in.md.
  - The redirect is loopback `127.0.0.1`, and later sign-ins may use another port [V].
  - Store credentials atomically with owner-only permissions [V] same page.
  - The button must say **"Continue with ChatGPT"** with approved branding [V] same page, UI/UX guidelines.
- **Preview limits:** Responses API only, `store:false`, `stream:true`; **`temperature`, `top_p`, `max_output_tokens`, `metadata` are rejected** [V] https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations.md.
  - That clashes with D11's "low temperature" grading, so the grader needs a fallback when the slot uses a ChatGPT plan.
- pi-ai implements this flow (§1); we pass `agentName` and `getDeviceId`.

## 7. Per-task model selection in comparable apps
- **LearnHarness (AGPL; learn, never copy):**
  - Three **tiers** `MODEL_SLOTS = ["strong","cheap","vision"]`. Background **roles** map to a tier (e.g. strong = prober and teacher; cheap = researcher, extractor, auditor; vision = visual-maker, pdf-reader) [V] https://github.com/amosblomqvist/learnharness/blob/main/src/core/settings.ts l.42–72.
  - Optional per-role override; resolution order **role override → slot → nothing** [V] same file and `src/core/settings-resolution.ts` l.106–124.
  - A slot stores `{provider, id}` plus a thinking level. If the first preferred level isn't supported, it is clamped [V] settings.ts l.73–80.
  - There are no factory defaults: actions refuse with `models_not_configured` and name the missing tier [V] settings.ts l.101–131.
- **OpenCode (MIT):**
  - `model` and `small_model` as `"provider/model"` strings; `small_model` is for "lightweight tasks like title generation" and falls back to a cheaper model from the same provider, then to the main model [V] https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/config.mdx.
  - Each agent can set its own `model` [V] docs/agents.mdx.
  - Newer config migrates `small_model` into a `title` agent's `model`, so per-task model = per-agent model [V] packages/core/src/config/normalize.ts l.137–151.
- **Cherry Studio (AGPL):**
  - Preferences `chat.default_model_id`, `feature.quick_assistant.model_id`, `feature.translate.model_id`, `feature.paintings.default_model_id`. Quick and translate fall back to the default; painting has no fallback because it needs an image model [V] https://github.com/CherryHQ/cherry-studio/blob/main/src/renderer/hooks/useModel.ts.
  - Setting the default fills the unset task slots ("cascade") [V] same file.
  - IDs are `providerId` + separator + `modelId` [V] src/shared/data/types/model.ts `createUniqueModelId`.
- **Common pattern:** one id string per task, falling back to a main model, with capability-specific slots (vision/image) that have **no** fallback.

## Cross-platform
| Concern | macOS | Windows | Linux |
|---|---|---|---|
| safeStorage backend | Keychain; **needs consistent code signing** or the Keychain re-prompts after every update [V] safe-storage.md | DPAPI; no prompt; other apps of the same user can decrypt [V] | libsecret / kwallet(5/6) / Flatpak portal; **`basic_text` = effectively plaintext** [V] |
| Calls may block for user input | yes (Keychain) [V] | no [V] | yes if a keyring prompts [V] |
| userData | `~/Library/Application Support/<name>` | `%APPDATA%\<name>`; name must avoid reserved characters [V] app.md | `$XDG_CONFIG_HOME/<name>` [V] |
| Atomic rename | POSIX rename is atomic [S] | `MoveFileExW` can fail `EPERM/EBUSY` if AV, indexer or OneDrive holds the file → **retry with backoff** [V] libuv, atomically | atomic [S] |
| File mode 0600 | works | ignored (ACLs); userData is per-user [S] | works |
| Ollama default | app on `127.0.0.1:11434` [V] faq.mdx l.185 | same; env vars set in the user's Environment Variables panel [V] faq.mdx l.123 | systemd service, same port [V] faq.mdx l.101 |
| LM Studio | port 1234 in docs [V] | same | same |
- **Use `127.0.0.1`, not `localhost`, as the default local URL.** Ollama binds IPv4 127.0.0.1 [V], and `localhost` can resolve to `::1` first on some systems [S].
- **pi-ai and its tree have no native modules,** so no per-OS rebuilds (§1) [V]. The only port it opens is the 1455 loopback during ChatGPT login [V]; whether this triggers a Windows Firewall prompt is [U] (loopback binds normally don't [S]).
- **CI should run the provider and settings tests on all three OSes,** especially the Windows rename-retry path (simulate with a held-open file handle) [U: to build].

## Corrections to 03-providers.md
- **pi-ai version and license:** 03 cited 0.84.0 with the license unconfirmed. **Now 1.4.0, MIT, confirmed** [V].
- **ChatGPT plan:** 03 said "apply to become a partner". **For open-source local apps, plan usage works through dynamic registration without applying;** the interest form is for paid or hosted apps [V] §6.
- **safeStorage:** "use the async API" is now **mandatory** (sync is removed in Electron 46) [V].
- **pi-ai includes Claude Pro/Max OAuth and reads `ANTHROPIC_OAUTH_TOKEN`.** 03 did not mention this; we must not use the stock Anthropic provider [V].
- **LM Studio:** `/api/v1/models` with `trained_for_tool_use` replaces `/api/v0/models … tool_use` [V].
- **models.dev:** a separate snapshot is largely redundant, because pi-ai's catalog *is* models.dev v2 [V]. Keep user overrides on top.
- **Ollama via `/v1`** cannot set `num_ctx` or `tool_choice`. 03's "one OpenAI-compatible adapter" needs an Ollama-native path or a clear setup step [V].

## Recommendations for v0.1
1. **Adopt pi-ai 1.4.0, pinned exactly** (`"@earendil-works/pi-ai": "1.4.0"`), inside a new `packages/providers`. Our `LLMProvider` interface (BLUEPRINT §5.2) wraps it; nothing outside `packages/providers` imports pi-ai. Upgrade on purpose, reading the CHANGELOG's "Breaking Changes".
2. **Register providers explicitly, never `providers/all`:**
   - `openaiProvider()`, `googleProvider()`, `openrouterProvider()`, a **custom Anthropic provider (API key only)**, and one `createProvider` per local server (Ollama, LM Studio, generic OpenAI-compatible) with `fetchModels`.
   - `createModels({ credentials: safeStorageStore, authContext: noAmbientEnv, identity: { userAgent: { custom: 'InterviewHarness/<ver>' } } })`.
3. **Run the provider layer in main for v0.1** (not a utility process). pi-ai is I/O-bound, and keys and safeStorage live in main. Revisit if streaming ever janks the UI.
4. **Keys:**
   - A `CredentialStore` that encrypts with `encryptStringAsync` into `userData/credentials.json` (atomic write).
   - Initialise after `app.whenReady()`.
   - On Linux, if `getSelectedStorageBackend() === 'basic_text'`, **show a warning and ask before saving** (or keep keys in memory for the session).
   - Handle `shouldReEncrypt` and "temporarily unavailable" (retry; never delete).
5. **Ollama adapter:**
   - Discover with `/api/tags` + `/api/show` (capabilities, `thinking`, context length).
   - Use the **native `/api/chat`** (a small custom pi-ai `api` implementation, or call it directly in our adapter) so we can send `options.num_ctx` and `think:false`.
   - Otherwise use pi-ai's `openai-completions` with `compat { supportsDeveloperRole:false, maxTokensField:'max_tokens' }` and tell the user to set `OLLAMA_CONTEXT_LENGTH`. Default URL `http://127.0.0.1:11434`.
6. **Structured output** (floor classifier, grader): one forced tool with `constrainedSampling: { type:'json_schema', strict:'prefer' }`, then `validateToolCall`, then one retry with the error. For local models, fall back to `format`/`response_format` JSON plus the schema in the prompt and temperature 0.
7. **Model slots:**
   - `slots: { interviewer, floor, grader, assistant }`, each `{ provider, model, reasoning? } | null`.
   - `floor` and `grader` fall back to `interviewer`; `assistant` has no fallback.
   - Each slot gets a capability check (tools, context ≥ needed), and actions refuse with a named missing slot (as LearnHarness does).
   - Store slots in `settings.json`, keys elsewhere.
8. **settings.json:**
   - `version` field, ordered migrations, quarantine invalid files, atomic write with win32 retry, one write queue.
   - Narrow `harness.settings` IPC with schema validation; a one-time localStorage import.
   - **Decide `productName` first** (it moves userData).
9. **Tests:** pi-ai's `fauxProvider()` as the scripted fake LLM; settings and credential stores tested with a temp dir; CI on macOS, Windows and Linux.
10. **ChatGPT plan:** behind a flag in v0.1. Build it on pi-ai's flow with `agentName:'InterviewHarness'`, a persisted UUID host id, the "Continue with ChatGPT" button, and a grader fallback for no-temperature. Add JWKS validation of the ID token ourselves.

## Open questions for the owner
1. **App name on disk:** set `productName: "InterviewHarness"` now, which moves userData from `…/@interviewharness/desktop` and needs a one-time copy of localStorage, or keep the current path?
2. **Linux `basic_text`:** warn and save anyway, keep keys in memory only for the session, or refuse?
3. **Ollama:** use its native API (better: context size and thinking control) at the cost of a second adapter, or only `/v1` plus a setup note about `OLLAMA_CONTEXT_LENGTH`?
4. **ChatGPT plan in v0.1:** ship it (OpenAI's docs suggest open-source local apps need no approval) or leave it for later?
5. **Slot fallbacks:** should `floor` and `grader` silently reuse the interviewer model, or must the user pick them explicitly (LearnHarness style)?
6. **Floor classifier:** worth a spike on Ollama/pi-ai "decision" classifier models versus a plain small chat model?
