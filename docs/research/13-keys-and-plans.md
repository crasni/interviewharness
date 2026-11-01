# Research: every way a user can bring a model (keys, plans, servers)

_Researched 2026-11-01. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

Goal: a really good way to use any key or plan the candidate has. Builds on `08-v01-providers.md` (pi-ai, Sign in with ChatGPT, safeStorage) and `12-model-picker-patterns.md` (Start step and Settings layouts); neither is repeated here. "pi-ai" means the installed `@earendil-works/pi-ai@1.4.0`, read file by file under `packages/providers/node_modules/@earendil-works/pi-ai/dist/`. "Jan source" means github.com/janhq/jan on `main`, read on the date above.

Today we support: ChatGPT plan (Sign in with ChatGPT), Ollama (native API), API keys for OpenAI, Anthropic (our key-only provider), Google, OpenRouter, and one custom OpenAI-compatible server.

## 1. Taxonomy of access

Six kinds, named by what the user has. For each: allowed for a third-party open-source desktop app, how auth works, and pi-ai support.

### 1.1 Subscription plans

| Plan | Allowed for us? | Auth | pi-ai |
|---|---|---|---|
| **ChatGPT (Plus/Pro/…)** | **Yes.** Open-source local apps use plan logins through dynamic client registration, no application [V] (08 §6). | OAuth, loopback | `openai` provider's subscription login (`openai.js`, "OpenAI (ChatGPT subscription)") [V]. We already ship it. |
| ChatGPT via the legacy Codex flow | **No.** Borrows the Codex CLI's client id `app_EMoamEEZ73f0CkXaXp7hrann` [V] `auth/oauth/openai-codex.js`. Superseded by the line above. | OAuth, fixed port 1455 | `openai-codex` [V] |
| **Claude (Free/Pro/Max/Ultra)** | **Only by spawning the user's own unmodified `claude` CLI.** Anthropic does not permit third parties to offer Claude.ai login or route requests through plan credentials, and forbids collecting or storing Claude.ai tokens [V] https://code.claude.com/docs/en/legal-and-compliance. The same page says nothing prevents an end user signing in to the unmodified Claude Code binary with their own plan [V]. Running it inside a product ties you to the Commercial Terms and the binary must not be modified [V] same page. Plan limits "assume ordinary, individual usage" [V] same page. | The CLI owns login | `anthropic.js` always registers "Anthropic (Claude Pro/Max)" OAuth [V]; never use it (ADR 0016). |
| **GitHub Copilot** | **Only through GitHub's official route.** GitHub officially supports Copilot plans in OpenCode (a partnership) [V] https://github.blog/changelog/2026-01-16-github-copilot-now-supports-opencode/. The Copilot SDK (GA 2026-06-02) lets apps use a user's Copilot plan via a GitHub OAuth App token; "SaaS applications building on top of Copilot" are a listed use case [V] https://github.blog/changelog/2026-06-02-copilot-sdk-is-now-generally-available/, https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk. The SDK drives Copilot's *agent runtime* (the Rust SDK bundles the Copilot CLI) [V], not a plain chat endpoint. | Device flow / OAuth App | `github-copilot` uses VS Code's client id (`Iv1.b507a08c87ecfe98`, base64 in source) and the private `copilot_internal/v2/token` endpoint [V] `auth/oauth/github-copilot.js`. **Not allowed** (borrowed client, private API). |
| **Google AI Pro/Ultra (Gemini)** | **No.** Gemini CLI's terms say using third-party software to reach the services behind Gemini CLI (their example: another app with Gemini CLI OAuth) violates the terms and can get the account suspended [V] https://www.geminicli.com/docs/resources/tos-privacy. For Google One users, Gemini CLI was replaced by Antigravity CLI on 2026-06-18 [V] same page. No sanctioned third-party path exists [S] https://discuss.ai.google.dev/t/gemini-subscription-access-for-third-party-apps-is-a-sanctioned-program-planned/175577. Spawning the official CLI is a grey area we don't need [U]. | — | none |
| **Kimi Code (Kimi For Coding membership)** | **Grey; key only, and not as a lead path.** Third-party tools use a plan API key plus base URL (up to 5 keys); benefits are "designed specifically for programming scenarios"; people building their own product are pointed to the pay-as-you-go Kimi Platform; changing the User-Agent counts as a violation [V] https://www.kimi.com/en/help/kimi-code/membership-guide. | API key (official clients use account login) | `kimi-coding`: key, plus an OAuth device flow with a hard-coded client id [V] `auth/oauth/kimi-coding.js`; whose client that is is [U]. Use the key only. |
| **Z.ai GLM Coding Plan** | **No.** The plan is for listed agent tools (ZCode, Claude Code, Codex, OpenCode, Cline, …) [V] https://docs.z.ai/devpack/overview.md; an earlier version said it is "strictly limited" to supported tools, and SDK or other third-party use can lose benefits [S] (search snippet of the same page). | API key | `zai`, `zai-coding-cn` (both point at the `/api/coding/` endpoint) [V] |
| **Qwen / Alibaba Token Plan, Coding Plan** | **No.** Only AI coding tools and OpenClaw-type agents; "custom applications" and app backends are excluded [V] https://help.aliyun.com/en/model-studio/more-tools, https://www.alibabacloud.com/help/en/model-studio/token-plan-team-overview. | API key | `qwen-token-plan`, `-cn`, `-individual` [V] |
| **MiniMax plan (M Plan / Token Plan)** | **Probably yes, key only.** The plan page says its key works with Claude Code, Codex, Cursor, OpenCode "or other AI tools" and states no tool restriction [V] https://platform.minimax.io/docs/token-plan/intro.md. Full terms not read [U]. | API key (`sk-cp-…`, separate quota from pay-as-you-go) [S] | `minimax`, `minimax-cn` (Anthropic-compatible endpoint) [V] |
| **Xiaomi MiMo Token Plan** | **Unclear; lean no.** Xiaomi's FAQ lists coding tools only; a review says it's coding-tools only [S] https://mimo.mi.com/docs/en-US/quick-start/faq/api-integration. Terms not found [U]. | API key (`tp-…`) | `xiaomi-token-plan-{ams,cn,sgp}` [V] |
| **OpenCode Zen / Go** | **Yes, key only.** OpenCode's docs list direct API endpoints and say you don't need OpenCode to use Go [S] (search summary of https://opencode.ai/docs/go.md); Zed and LiteLLM ship it as a key provider [V] https://zed.dev/docs/ai/use-an-existing-subscription. | API key | `opencode`, `opencode-go` [V] |
| **xAI SuperGrok, Meta Muse** | **No.** No official third-party OAuth docs found; community packages say they reuse the Grok CLI's public client id because xAI allowlists clients [S] https://github.com/stnly/pi-grok. | Device flow | `xai`, `meta` subscription logins with fixed client ids [V] `auth/oauth/xai.js`, `meta.js`. |

Rule we can apply to every future plan: **allowed only if the vendor documents third-party use with that plan, and auth is either the vendor's own documented OAuth for apps or a plan key the vendor tells users to paste into other tools.** Borrowed client ids and private endpoints are always out.

### 1.2 Direct API keys
- Always allowed: the developer terms of every vendor cover the key owner's own use [V for Anthropic: legal page above; others assumed] [U].
- pi-ai has key providers for OpenAI, Anthropic, Google, Mistral, xAI, DeepSeek, Groq, Cerebras, Together, Fireworks, Moonshot (`moonshotai`, `-cn`), MiniMax, Hugging Face, NVIDIA, Baseten, Ant Ling, Xiaomi [V] `dist/providers/*.js` (each `envApiKeyAuth("…", ["X_API_KEY"])`). All are one key, fixed base URL, built-in model catalog from models.dev.
- Each reads its env var by default; our `authContext` already turns that off (ADR 0016).

### 1.3 Aggregators and gateways
- **OpenRouter:** key, or the official **OAuth PKCE** that mints a key on the user's account; localhost callbacks on any port are allowed for local apps [V] https://openrouter.ai/docs/guides/overview/auth/oauth. pi-ai has both (`openrouter.js`, `auth/oauth/openrouter.js` with an ephemeral loopback port) [V]. Best "sign in" experience for a key-based provider.
- **Vercel AI Gateway:** key (`AI_GATEWAY_API_KEY`) [V] `vercel-ai-gateway.js`.
- **Cloudflare AI Gateway / Workers AI:** key plus account id plus gateway id [V] `cloudflare-auth.js`.
- **LiteLLM, company gateways:** OpenAI- (or Anthropic-) compatible server with a key; no pi-ai provider needed. Jan documents exactly this case [V] Jan source `docs/.../remote-models/custom-endpoint.mdx`.

### 1.4 Cloud platforms
- **AWS Bedrock:** Bedrock API keys are bearer tokens; short-term (≤12 h) or long-term (until a set expiry, "for exploration only") [V] https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html. pi-ai's login offers bearer token, AWS profile, or "existing AWS credential chain", and its resolver also detects ambient AWS credentials [V] `amazon-bedrock.js`. **Only the bearer-token path fits our no-ambient rule;** a short-term key expiring mid-interview is a real risk.
- **Google Vertex:** API key (`GOOGLE_CLOUD_API_KEY`) or gcloud application default credentials, plus project and location [V] `google-vertex.js`. ADC is ambient (reads `~/.config/gcloud/...`); only the key path fits.
- **Azure OpenAI:** key plus resource base URL [V] `azure.js`; Jan does the same [V] Jan `constants/providers.ts`.
- Allowed: the user's own cloud account. Mostly an enterprise path; low priority for a student-practice app.

### 1.5 Local runtimes
- **Ollama** (we use its native API), **LM Studio** (port 1234), **llama.cpp** `llama-server`, **vLLM**: OpenAI-compatible `/v1`, key optional (08 §3) [V].
- **Jan's own engine:** Jan exposes a local OpenAI-compatible server at `http://127.0.0.1:1337/v1`; the key is optional on 127.0.0.1 [V] Jan source `docs/.../desktop/api-server.mdx`. For the owner, Jan is just another local server.
- No ToS question. pi-ai has no Ollama/LM Studio providers; we use `createProvider` (08).

### 1.6 Spawn the vendor's CLI
- **`claude`:** the only Claude-plan route we accept (AGENTS.md); see 1.1. Precedents: Zed has no Claude plan provider and sends users to Claude as an external agent that owns its own auth [V] https://zed.dev/docs/ai/use-an-existing-subscription. Cherry Studio has a `claude-code` provider whose auth method is `'external-cli'`, a login probe, and a "warm query" manager to keep a process ready [V] source `src/main/ipc/handlers/oauth.ts`, `src/main/ai/runtime/claudeCode/`. **Voice latency** is the open risk: a process per turn is too slow; a long-lived streaming process is needed [U] (not measured by us).
- **`codex`:** not needed; Sign in with ChatGPT is the official path to the same plan.
- **`gemini`:** see 1.1; the plan route is forbidden for third-party software and the CLI is being replaced. Skip.
- **Copilot CLI / SDK:** official, but it is an agent runtime with its own tools and loop, not a chat endpoint [V] (1.1). Possible later; heavy.

## 2. Jan, in depth

Jan is a Tauri app (Rust + React). Desktop chat and a newer terminal agent ("Jan Agent") share one provider store.

### Providers screen
- **Settings → Model Providers** is a list of every provider with a **switch per row** ("active"). Turning one off hides its models everywhere; when on, the row links to its detail page [V] `web-app/src/routes/settings/providers/index.tsx`.
- Built-in remote providers ship pre-filled: OpenAI, Azure, Anthropic, OpenRouter, Mistral, Groq, xAI, Gemini (via Google's OpenAI-compatible endpoint), MiniMax, Hugging Face, NVIDIA, each with a fixed base URL and a link to "where to get a key" [V] `web-app/src/constants/providers.ts`. Local engines (llama.cpp, MLX on macOS) sit in the same list [V].
- A global "Strip reasoning from context" switch sits above the list [V] `locales/en/provider.json`.

### Adding a provider and entering a key
- Built-ins need no adding: open one, paste the key. One field, password-type with show and copy actions [V] `constants/providers.ts`.
- **Extra keys** live under "Advanced"; "Jan will try the next one automatically if a key fails". **"Test keys"** calls `/models` with each key and shows a status per key [V] `locales/en/providers.json` (`apiKeys.*`).
- **Custom providers:** "Add Provider" opens "Add Custom Provider": name, **API format (OpenAI-compatible or Anthropic-compatible)**, base URL, key [V] `locales/en/provider.json`. The docs say the key is required, so local servers get a dummy, and warn that a missing `/v1` gives 404s [V] `docs/.../remote-models/custom-endpoint.mdx`.
- **Keys go to the OS keyring** (service `jan-providers`), never the settings file or web storage; if the keyring is unavailable (headless Linux), an AES-GCM file with mode 0600 [V] `src-tauri/src/core/server/provider_secrets.rs`.
- Jan Agent's key login is strict about order: trim, reject keys with spaces ("copy it again"), check against the provider's model list over HTTP, **then** store; a rejected key leaves nothing behind [V] `src-tauri/src/core/cli/auth/providers.rs`.

### Model lists
- **Remote fetch:** once a key is present and the model list is empty, Jan fetches `/models` automatically, once [V] `$providerName.tsx` (auto-catalog effect). "Refresh" adds new ones ("Added {{count}} new model(s)") [V] `providers.json`.
- **Manual add:** "+" adds a model id, with a link "See model list from {{provider}}"; per-model capability toggles (tools, vision, …) behind a caution [V] `providers.json` (`addModel`, `editModel`).
- Unknown providers get a notice that capabilities are not auto-detected [V] `providers.json` (`limitedSupport`).
- **Local:** downloaded from the Hub (Hugging Face) or imported; each local model has Start/Stop [V] `providers.json`, `docs/.../manage-models.mdx`. First run downloads one recommended model (doc 12).

### Choosing a model in a chat
- One dropdown in the chat input lists models from every **active** provider, with fuzzy search over model id, provider and capabilities, and **favorites** pinned at the top [V] `web-app/src/containers/DropdownModelProvider.tsx`.
- A provider counts as usable when it has a key (remote) or a chat model (local/custom); embedding-only does not count, and onboarding stays until one is usable [V] `web-app/src/lib/providerReadiness.ts`.

### Status and errors
- Errors name the fix: "Provider must have base URL and at least one API key configured to fetch models."; "Failed to fetch models from {{provider}}. Please check your API key and base URL." [V] `providers.json`.
- Engine errors are specific and plain ("There is not enough memory to run this model. A smaller model or a smaller context size usually helps.") [V] `locales/en/model-errors.json`.

### Plans in Jan
- Jan Desktop's providers are **keys and servers only**; no subscription sign-in in the provider list [V] (`constants/providers.ts`).
- Jan Agent's source contains account sign-in for "Codex" and "Claude" using the **Codex CLI's and Claude Code's own OAuth client ids** [V] `src-tauri/src/core/cli/auth/account.rs` (`begin()`). That is exactly the borrowed-client pattern we must not copy (1.1). Whether Jan Desktop surfaces it is [U].
- Jan also *serves* models: its local API server can be pointed at by Claude Code ("Settings → Claude Code" sets env vars) [V] `routes/settings/claude-code.tsx`.

### What the owner likely likes
1. **Everything is one list, and every row means the same thing**: a place models come from, on or off. Plans, keys, local engines and custom servers look alike.
2. **No ceremony for built-ins:** paste a key and models appear on their own.
3. **Custom endpoints are first-class**, with a protocol choice (OpenAI or Anthropic), so any gateway, plan key or server works without waiting for Jan to add it.
4. **One picker in the chat** across all sources, searchable, with favorites.
5. Plain, fix-naming errors; keys in the OS keyring.

What doesn't fit us: the per-provider on/off switch (our slots already decide what's used), per-model capability toggles (we check by asking the model), and fallback keys (a mock interview has one key per connection).

## 3. Other many-access apps (plans and provider management only)

- **OpenCode:** `/connect` lists 75+ providers (AI SDK + models.dev); each asks for a key or a sign-in; credentials go to `~/.local/share/opencode/auth.json`. Plans: Copilot (device code, official partnership), ChatGPT Plus/Pro (browser), GitLab Duo, xAI SuperGrok. **Claude Pro/Max plugins were removed in 1.3.0** because Anthropic prohibits them. "Other" adds a custom provider in config [V] https://opencode.ai/docs/providers/. Lesson: a long catalog behind one "connect" verb; plans and keys share it.
- **Zed:** five access paths by how you pay (doc 12). Plans: ChatGPT built in; **Claude and Cursor only as external agents** that own their auth; Copilot built in for Copilot Chat; OpenCode Zen/Go as a key [V] https://zed.dev/docs/ai/use-an-existing-subscription. Lesson: when a plan has no allowed API route, hand off to the vendor's tool rather than fake it.
- **Cherry Studio:** provider list with switches (doc 12), plus OAuth sign-in per provider where the vendor offers one (`oauth.sign_in`, `oauth.logout`, `has_token`), a Copilot provider via models.dev, and a Claude Code provider with auth method `'external-cli'` and a login probe [V] source `src/main/ipc/handlers/oauth.ts`, `packages/provider-registry/src/providers/copilot.ts`. Lesson: auth *method* is a field on the provider (key, OAuth, external CLI), so one list holds all three.
- **pi coding agent (pi-ai's own app):** every provider declares `auth: { apiKey?, oauth? }`; subscription logins carry `isSubscription: true` and a `loginLabel` ("Sign in with Kimi Code") [V] `dist/providers/kimi-coding.js`. Lesson: the library already models "key or plan" per provider; we only filter which methods we register.
- **LobeHub:** adds plan providers one by one as their own entries (e.g. "SuperGrok" via device flow, with the line that sign-in only happens on xAI's page) [S] https://lobehub.com/docs/usage/providers/supergrok. Lesson: a plan is its own row, named after the plan, not a mode of the API-key row.

## 4. Recommendation for InterviewHarness

### What to support, in order
1. **Keep:** ChatGPT plan, Ollama, OpenAI, Anthropic (key only), Google, OpenRouter.
2. **Many custom servers, not one,** each with a name, address, optional key, and **API format: OpenAI-compatible or Anthropic-compatible** (Jan's dialog). One feature covers LM Studio, llama.cpp, vLLM, Jan's server, LiteLLM, company gateways, and plan keys that vendors document for other tools (MiniMax, Kimi).
3. **OpenRouter sign-in** (official PKCE; pi-ai has it) next to "paste a key". The cleanest "log in instead of copying a key" we can offer today.
4. **More key providers from pi-ai's catalog,** behind a searchable "More providers" list: DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face, Vercel AI Gateway, OpenCode Zen/Go, MiniMax. Cheap: same key-only `savedKeyOnly` wrapper we use for Google.
5. **Claude plan through the user's own `claude` CLI** (AGENTS.md), as a separate spike: detect the binary, check it's signed in, keep one warm streaming process, measure first-token latency against the Floor Manager's budget before shipping.
6. **Later, maybe:** Azure, Bedrock (bearer key only), Vertex (API key only); Copilot via the official SDK if its agent runtime can be held to plain turns.

### What to refuse, and the one-line reason we show
- Claude plan login inside the app: Anthropic forbids it; use the Claude app's own CLI instead.
- Gemini plans (AI Pro/Ultra) via Gemini CLI credentials: Google forbids it and suspends accounts.
- Copilot via pi-ai's flow, ChatGPT via the legacy Codex flow, SuperGrok, Meta Muse: borrowed client ids or private endpoints.
- Z.ai Coding Plan, Qwen/Alibaba Token and Coding Plans: the vendor limits them to listed coding tools; a pay-as-you-go key from the same vendor works.
- Ambient credentials of any kind (env vars, AWS chain, gcloud ADC, other apps' token files).

Keep the refusals out of the main list; put one plain line in "More providers" search results ("Z.ai Coding Plan can't be used here. A Z.ai API key can.") so people aren't left guessing.

### UI model: "Connections" stay the one list; adding one is a search
Every source is a **connection** with a kind (plan, key, this computer, server), a status word, and one action. Both slots pick from every connection's checked models (doc 12 proposal 5A). Adding a connection opens a short searchable list grouped by kind. Picking an item shows only that item's fields, and the one button runs the existing check (one short reply) and saves only if it answers.

```
 Settings → Model                                    (page scrolls inside)
 ─────────────────────────────────────────────────────────────────────
 Interviewer   [ gpt-5 · ChatGPT plan                         v ]
 Feedback      [ Same as interviewer                          v ]

 Connections
   ChatGPT plan        Signed in                   Sign out
   Ollama              Running · 3 models          Look again
   Anthropic           Key saved in your keychain  Replace · Remove
   Home server         OpenAI-compatible · 2 models  Edit · Remove
   [ + Add a connection ]

 ── Add a connection ──────────────────────────── (sheet, own scroll)
   [ Search providers…                     ]
   Plans you already pay for
     ChatGPT                Sign in with your browser
     Claude                 Uses the claude app on this computer
   Sign in
     OpenRouter             Sign in, or paste a key
   API keys
     OpenAI · Anthropic · Google · DeepSeek · Mistral · xAI · …
   On this computer or your network
     Ollama · LM Studio · Other server (OpenAI or Anthropic format)

 ── After picking "DeepSeek" ──────────────────────────────────────────
   API key   [ ••••••••••••••••     ]   Get a key ↗
   Model     [ deepseek-chat      v ]   (fetched with the key)
                                        [ Check and save ]
   It answered in 1.2 s. Saved.
```

- **Start screen:** keep doc 12's three short choices (My ChatGPT plan / A model on this computer / An API key or other server). The third opens the same "Add a connection" list, already filtered to keys and servers, so first run and Settings share one component.
- **Model lists:** fetch from the provider with the key just entered (Jan's auto-fetch); fall back to pi-ai's built-in catalog; allow typing an id. Only checked models are offered in the slots.
- **Status words:** literal and short: "Signed in", "Key saved in your keychain", "Running · 3 models", "Not running", "Key rejected · Replace", "Signed out by ChatGPT · Sign in". No dots or colours.
- **Errors name the field** (Jan's style): "The server answered 404. The address usually ends in /v1."
- Multiple connections of the same provider are allowed only for servers (each has its own name), which keeps the list short.

### Fit with our constraints
- Checked before saved: every add or replace ends in the one-short-reply check; the key is written to safeStorage only after it answers (Jan Agent's order).
- Two slots: unchanged; slot pickers group models by connection.
- Keys only in the OS credential store; Linux `basic_text` warning stays (08).
- No ambient credentials: register only key and allowed OAuth methods; Bedrock and Vertex only in key mode.
- Full-height screens: the page and the add sheet each scroll inside their own region.

## Open questions for the owner
1. Do we want the long tail of key providers (item 4), or keep the list short and send everything else through "Other server"?
2. Should MiniMax/Kimi plan keys be named rows ("Kimi Code plan key"), or only reachable through "Other server" since their terms are unclear for non-coding-agent apps?
3. Claude-via-CLI: worth a latency spike now, or after the Floor Manager has a measured budget?
4. Do we show refused plans in search with a reason, or leave them out entirely?
