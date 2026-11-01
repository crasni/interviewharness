# Research: how apps present "pick a model"

_Researched 2026-11-01. [V] = verified against a primary source; [S] = secondary sources only; [U] = unverified._

Goal: redesign two surfaces, the first-run model step on Start (`start/ModelStep.tsx`) and Settings → Model (`settings/ModelPage.tsx`). Today the first-run step stacks three things at once (a "Continue with ChatGPT" button, an Ollama section with a dropdown, an "API key or other server" form), and Settings shows "Connections" then the "Interviewer model" and "Feedback model" dropdowns.

Fixed constraints for the proposals: three ways in (ChatGPT plan, Ollama, API key or other server); every model answers one short reply before it is saved; two slots (Interviewer, optional separate Feedback); screens are fixed to the window height and long content scrolls inside its own region.

"Source" below means the app's own repository on GitHub (UI strings, locale files, components), read on the date above. UI labels are quoted because they are the evidence; nothing longer is quoted.

## 1. Per app

### Zed
- **Five ways in, named by how you pay:** Zed-hosted models, your own API key, an existing subscription (ChatGPT, Claude, Copilot), a gateway (OpenRouter, Bedrock, Vercel), a local model [V] https://zed.dev/docs/ai/llm-providers, https://zed.dev/docs/ai/quick-start.
- **First run:** the onboarding "Basics" page has a small "Agent Setup" block with "Sign In" / "Start Free Trial" for Zed's own plan and a line about installing agents. No key or local setup at first run [V] source `crates/onboarding/src/basics_page.rs`. Everything else is deferred to the Agent Panel's settings.
- **Settings layout:** one page, "LLM Providers", with a section per provider; "Add Provider" adds an OpenAI- or Anthropic-compatible one ("Add {}-Compatible Provider", "Provider Name", "API URL", "Models") [V] source `crates/settings_ui/src/pages/llm_providers_page.rs`.
- **Key entry:** paste into a field; once saved, the field **collapses into a card**: "API Key Configured" with a "Reset Key" button. The key is never shown again. The line under it says "Stored in the system keychain, not in settings.json." [V] same file and `crates/ui/src/components/ai/configured_api_card.rs`. Keys from environment variables win over the keychain and show "API Key Set in Environment Variable" [V] https://zed.dev/docs/ai/use-api-access.
- **Plan login:** ChatGPT section says "Sign in with your ChatGPT Plus or Pro subscription to use OpenAI models in Zed's agent", then "Sign In" → "Signing in…" → "Signed in as …" with "Sign Out" [V] source `crates/language_models/src/provider/openai_subscribed.rs`.
- **Local:** Ollama models are auto-discovered from the default `http://localhost:11434`; `auto_discover: false` turns it off [V] https://zed.dev/docs/ai/use-a-local-model. The Ollama section has an empty state ("Run local models on your machine with Ollama.", "Download Ollama", "Start Ollama and download a model:") and then an explicit "Connect" → "Connected", plus "Refresh Models" and "Reset API URL" [V] source `crates/language_models/src/provider/ollama.rs`.
- **Model choice:** one default model, picked in the thread's model selector (the choice is saved as the default). Inline Assistant, commit messages and thread summaries can each have their own model, but only in `settings.json` [V] https://zed.dev/docs/ai/agent-settings. Per-task models exist but stay hidden.
- **Validation:** no separate "Verify" button found; a provider is "configured" when a key is stored [U] (not stated in docs; source strings show none).

### VS Code (Copilot BYOK)
- **Model choice lives in the chat input's model picker.** A gear in the picker opens the **Language Models editor**: a searchable list of models with provider, capabilities, context size and billing, filterable by provider and visibility [V] https://code.visualstudio.com/docs/copilot/customization/language-models.
- **Show/hide and pin:** an eye icon hides a model from the picker; pinned models get their own section [V] same page.
- **Adding a provider:** pick a built-in provider from a list, enter key or endpoint; some providers open `chatLanguageModels.json` for the rest. A gear next to a configured provider changes key or endpoint. Ollama moved from built-in to the official Ollama extension [V] same page.
- **Per-task models:** inline chat, utility tasks (titles, commit messages: `chat.utilityModel`, `chat.utilitySmallModel`) and voice have separate settings [V] same page.
- **Key validation:** not described in the docs [U]. The BYOK launch post (2025-10-22) is high-level only [V] https://code.visualstudio.com/blogs/2025/10/22/bring-your-own-key.
- Note: the plan (Copilot) is the default and BYOK is layered on; the picker merges both into one list.

### Cursor
- **Settings → Models:** paste a key into a provider's field and "Save"; that provider's models then appear in the picker. Providers: OpenAI, Anthropic, Google, Azure OpenAI, Bedrock. Own keys work for chat only, not tab completion [V] https://cursor.com/docs/settings/api-keys.
- **Criticised:** the "Verify" step silently uses a fixed OpenAI model (gpt-4o), so disabling that model or using a custom base URL makes verification spin forever [S] https://forum.cursor.com/t/custom-openai-api-key-verification-stuck/96185. "Override OpenAI Base URL" applies globally and breaks unrelated built-in models; toggles give misleading errors ("Model name is not valid") [S] https://forum.cursor.com/t/override-openai-base-url-breaks-requests-when-pointing-to-openrouter/142520, https://forum.cursor.com/t/byok-databricks-ai-gateway-custom-model-names-rejected-model-name-is-not-valid/168131. **Lesson: check the model the user actually picked, and keep a custom server's address scoped to that one connection.**

### Cline
- **First run, old welcome view:** one primary full-width button "Get Started for Free" (sign in), one secondary "Use your own API key" that **expands in place** into the provider form; the final "Let's go!" stays disabled until the form validates [V] source `apps/vscode/webview-ui/src/components/welcome/WelcomeView.tsx`.
- **First run, current onboarding:** a wizard. Step 1 "How will you use Cline?" with three choice cards: "Absolutely Free", "Frontier Model", "Bring my own API key". Next steps: "Select a free model" / "Select your model" / "Configure your provider", each with "Back"; sign-up shows "Almost there!" while the browser is open [V] source `.../components/onboarding/data-steps.ts`, `OnboardingView.tsx`.
- **Settings:** "API Provider" dropdown → fields for that provider (key; nothing for Ollama/LM Studio, which "must be running") → "Model" dropdown [V] https://docs.cline.bot/getting-started/selecting-your-model. Dropdown-then-fields.

### Roo Code
- Welcome screen asks you to choose a provider, with OpenRouter marked "Recommended"; paste key; pick model [V] https://roocodeinc.github.io/Roo-Code/getting-started/connecting-api-provider. Settings keep Cline's dropdown-then-fields shape plus named "API Configuration Profiles" [U] (sidebar entry only).

### Cherry Studio
- **First run:** "Welcome to Cherry Studio" with "Sign in to Cherry Cloud" / "Connect CherryIN" as the lead, "Set up another provider" as the alternative, "Set up later" to skip, and a reassurance line "You can change providers anytime in Settings". Then "Choose a Provider" and "Choose Default Model" ("You can change this anytime in settings", "Get Started") [V] source `src/renderer/i18n/locales/en-us.json` (`onboarding.*`).
- **Settings:** provider list with per-provider **Enable switch**, detail pane with API key, API address, "Get model list", and a **Test/Check** button where the user **picks which model to test** (and which key, if several) [V] https://docs.cherryai.com.cn/docs/en-us/pre-basic/settings/providers. A provider whose switch is off contributes no models (common confusion source, called out in the docs).
- **Per-task models:** "Default Assistant Model" ("Used when an assistant has no model"), "Quick Model" (naming, keyword extraction; tooltip says choose a lightweight, non-reasoning model), "Translate Model" [V] same locale file (`settings.models.*`).
- Its diagnostics page asks before a real test call: "Send one short test message to {model} … This may incur provider usage charges." [V] same file. Same idea as our "one short reply" check, made explicit.

### Chatbox
- **First run:** a welcome modal with a short pitch and two actions: "Setup Provider" and "Setup later" [V] source `src/renderer/modals/Welcome.tsx`.
- **Settings → Model Provider:** list of built-in providers, "Add" at the bottom for a custom one (name, API type, key, host); after saving, "Check" confirms the connection [V] https://docs.chatboxai.app/en/guides/providers.

### LobeChat / LobeHub
- **Settings → provider list + detail pane.** Each provider: API Key, proxy URL, a "Connectivity Check" row with a "Check" button ("Test if the API Key and proxy address are filled in correctly") that turns into "Check Passed" [V] source `locales/en-US/setting.json` (`llm.checker.*`), `locales/en-US/modelProvider.json`.
- Shows where the key goes in plain words: keys and address "will be encrypted using the AES-GCM encryption algorithm" [V] same file. Advanced toggle "Use client request mode" is behind the main fields [V].
- Ollama: an address field that "can be left blank if not specified locally", and an in-app model download with progress when the chosen tag is missing [V] `modelProvider.json` (`ollama.*`).

### Jan
- **First run is local-first:** it checks hardware ("{gpus}, driver …", "no GPU detected"), then offers to download one recommended model ("Your first model", "{model} ({size}) ready to download"), with "Step x of y" and "Skip for now" [V] source `web-app/src/locales/en/setup.json`.
- **Settings → Model Providers:** one page per provider; cloud providers take a key, then "Refresh" fetches models; errors say what to fix ("Please check your API key and base URL.") [V] source `web-app/src/locales/en/providers.json`; https://docs.jan.ai/desktop/remote-models/openai.

### Open WebUI
- **Admin → Connections:** two groups, "Manage OpenAI API Connections" and "Manage Ollama API Connections", each a list of URLs with a gear; "+" opens "Add Connection" (Connection Type Local/External, API Base URL, API Key, optional model IDs "Leave empty to include all models…", Enabled/Disabled) and a **"Verify Connection"** button that reports "Server connection verified" [V] source `src/lib/components/AddConnectionModal.svelte`, `admin/Settings/Connections.svelte`.
- Models are auto-listed from every connection into one selector [V] https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/. Groups by **protocol**, not by how the user pays; fine for admins, technical for end users.

### Raycast AI
- Presents **four kinds side by side, named by what the user brings**: "Bring Your Own Key" (Anthropic, Google, OpenAI, OpenRouter), "Bring Your Own Subscription" (Claude, ChatGPT), "Custom Providers" (any OpenAI-compatible endpoint), "Local Models" (Ollama), next to Raycast-hosted models [V] https://manual.raycast.com/ai/byoai. Close to our three-way split.
- Keys go in Settings → AI → "Custom API Keys" [S] (changelog via search: https://www.raycast.com/changelog/1-100-0).

### JetBrains AI Assistant
- **Settings → Tools → AI Assistant → Providers & API keys:** pick a provider (Anthropic, Google, OpenAI, OpenAI-compatible, Ollama, LM Studio), enter key or URL, **"Test Connection"** [V] https://www.jetbrains.com/help/ai-assistant/use-custom-models.html.
- **"Models Assignment":** two slots, "Core features" and "Instant helpers", plus context window for local models. Big-provider models are assigned automatically; local and compatible ones only appear in chat until assigned by hand [V] same page. **The closest match to our Interviewer / Feedback slots.**
- "Activate JetBrains AI" (the plan) sits beside own keys, and fills in features your models can't do [V] same page.

### Continue.dev, LM Studio, Msty
- **Continue:** models and roles (chat, edit, apply, autocomplete…) are set in `config.yaml`; the docs show no UI flow [V] https://docs.continue.dev/customize/model-providers/overview. Not useful for us.
- **LM Studio:** first run is "Discover" (download a model), then a model loader in Chat; it is a server, not a picker of servers [V] https://lmstudio.ai/docs/app/basics.
- **Msty:** first run asks whether to use existing local models, set up a new local model, or add an online provider's key; the old docs call local "the quickest way" [S] (official docs seen only through a search summary: https://docs.msty.studio/getting-started/onboarding, https://docs.msty.ai/studio/getting-started/quick-start).

Skipped for lack of good material: Warp (BYOK doc 404), Witsy, Claude Desktop and ChatGPT desktop (no third-party model choice).

## 2. Recurring patterns

1. **One lead path, the rest one step away.** Cline ("Get Started for Free" + "Use your own API key" that expands), Cherry ("Sign in to Cherry Cloud" + "Set up another provider"), Zed (only "Sign In" at onboarding), Jan (local download first). Nobody we found shows three full forms at once on first run. When there is no single obvious lead, the app asks first ("How will you use Cline?" cards) and then shows only that path.
2. **Settings = list of connections + one detail at a time.** Cherry, LobeChat, Jan, Chatbox, Zed, Open WebUI. Status is a per-row state (switch, "Connected", "API Key Configured", "Check Passed"). The model choice itself lives elsewhere: in a picker (Zed, VS Code, Cursor) or in named slots (JetBrains, Cherry).
3. **A key, once saved, becomes a status line, not a field.** Zed's "API Key Configured · Reset Key" card is the cleanest; LobeChat and Zed say where the key is stored in one line.
4. **An explicit check, and it must check the right thing.** "Check" (LobeChat, Chatbox, Cherry), "Test Connection" (JetBrains), "Verify Connection" (Open WebUI). Cherry lets you pick the model to test; Cursor's hidden fixed-model check is the main complaint we found. Ours (the chosen model must answer) is already the strong form.
5. **Slots with a "same as" default, extra slots hidden.** Zed (one default, per-feature only in JSON), Cherry (Default / Quick / Translate), VS Code (utility model), JetBrains (Core features / Instant helpers). The second slot defaults to following the first.
6. **Local servers: detect quietly, then show an honest empty state.** Zed auto-discovers and offers "Download Ollama" plus "Refresh Models"; Jan checks hardware first. Advanced fields (address, context window, headers, client mode) sit behind the main fields.

## 3. What fits InterviewHarness
- **Name the kinds by what the user has, not by protocol** (Raycast's framing): "My ChatGPT plan", "A model on this computer", "An API key". Literal, and matches our three ways in. Open WebUI's OpenAI-API vs Ollama-API grouping is the one to avoid.
- **One primary button per screen**, whose label says what will happen ("Sign in with ChatGPT", "Use this model", "Check and save"). Fold our required check into that button rather than a separate "Verify": the button runs the one short reply and saves only if it answers. Show the result as one quiet line under it ("Checking qwen3:8b…" → "It answered. Saved." or a plain error naming the field to fix).
- **Detect Ollama before drawing the step**, so the local option can say something true ("Ollama is running, 3 models") or be honest ("Ollama isn't running on this computer").
- **Collapse saved keys** into "Key saved in your system keychain · Replace" (Zed's pattern), never re-show them.
- **Feedback slot follows the interviewer by default** and stays one quiet row.
- Server address, model ID typing and "treat as small" live behind "More options" in the API-key path.

## 4. Proposals: first-run step on Start

The step fits in the fixed-height Start screen; only the expanded option's body scrolls if needed.

### A. Three rows, one open at a time (recommended)
Three plain rows, each a radio choice with a one-line description. Choosing one opens its body under it and closes the others. One primary button at the bottom whose label follows the choice. Pre-select the likely row: Ollama if it is running with models, otherwise ChatGPT.

```
 Choose how the interviewer thinks

 ( ) My ChatGPT plan
     Signs in through your browser.
 (•) A model on this computer
     Ollama is running · 3 models
     Model  [ qwen3:8b            v ]
 ( ) An API key or other server
     OpenAI, Anthropic, Google, OpenRouter, or any OpenAI-compatible server.

                              [ Use this model ]
                    It answered in 1.4 s. Saved.
```
- Pros: everything visible at a glance, but only one form; one primary action; no extra screen; detection makes the default right most of the time.
- Cons: the API-key body (provider, key, model, maybe address) is the tallest and makes the step jump in height; needs care so the button doesn't move far (keep it pinned at the bottom of the step).

### B. Lead with one, "Other ways" below (Cline / Cherry style)
Show only the best guess as a full-width primary action; the other two are quiet text links that swap the body in place.

```
 The interviewer needs a model to think with.

 [ Sign in with ChatGPT ]
   Uses your ChatGPT plan.

 Other ways:  A model on this computer · An API key or other server
```
- Pros: the calmest first impression; one decision for most people.
- Cons: hides two of three options behind links, which feels like a push toward ChatGPT for local-first users; the guess must be good (use Ollama detection to flip the lead).

### C. Ask, then show one path (two short screens)
Screen 1: three large choice rows (no fields) and "Continue". Screen 2: only that path's fields, "Back", and the primary "Check and save".

```
 1/2  How should the interviewer run?      2/2  An API key
  [ My ChatGPT plan              > ]         Provider [ Anthropic   v ]
  [ A model on this computer     > ]         Key      [ ••••••••••••• ]
  [ An API key or other server   > ]         Model    [ claude-…    v ]
                                             More options
                                          [Back]        [ Check and save ]
```
- Pros: each screen is tiny and never overflows; closest to the current Cline onboarding.
- Cons: an extra click and a step counter for a one-time task; the ChatGPT path's second screen is almost empty (just "Sign in"), so it could act directly from screen 1.

## 5. Proposals: Settings → Model

The page is fixed to the window; the connections list is the part that scrolls.

### A. Slots on top, connections below (recommended)
What matters (which model interviews, which gives feedback) comes first; where models come from comes second. Each slot is a picker grouped by connection; its last item is "Add a connection…". Connections are compact rows with a status word and one action.

```
 Interviewer   [ gpt-5 · ChatGPT plan          v ]
 Feedback      [ Same as interviewer           v ]

 Connections
  ChatGPT plan          Signed in as l…@…      Sign out
  Ollama                Running · 3 models     Look again
  Anthropic             Key saved              Replace · Remove
  + Add a connection
```
- Pros: matches pattern 5 (JetBrains' assignment slots); Feedback is one quiet row; adding a connection reuses the first-run body (same component as proposal 4A, in a sheet or inline row).
- Cons: picking a model that hasn't been checked yet must run the check on selection (show "Checking…" next to the picker), so the picker itself needs a pending and failed state.

### B. Connection list + detail pane
Left: the connections plus "Add". Right: the selected connection's details (status, key card, models it offers, "Use for interviewer"). Slots pinned at the top of the page.

```
 Interviewer [ gpt-5 v ]   Feedback [ Same v ]
 ┌────────────────┬──────────────────────────────┐
 │ ChatGPT plan ● │ Anthropic                    │
 │ Ollama       ● │ Key saved in your keychain   │
 │ Anthropic    ● │                 Replace      │
 │ + Add          │ Models: claude-…, claude-…   │
 │                │ Remove connection            │
 └────────────────┴──────────────────────────────┘
```
- Pros: the familiar Cherry/LobeChat/Jan shape; room for per-connection detail; each column scrolls on its own.
- Cons: heavy for three kinds and usually one or two connections; two panes in a narrow window; status dots risk decoration.

### C. One list of models, two columns of choice
Every checked model from every connection is a row; two radio columns assign the slots. Connections are managed in a small "Manage connections" sheet.

```
                                 Interviewer  Feedback
 gpt-5           ChatGPT plan        (•)         ( )
 qwen3:8b        Ollama              ( )         (•)
 claude-…        Anthropic           ( )         ( )
 Feedback: [x] same as interviewer   Manage connections
```
- Pros: one glance shows every option and both choices; no dropdowns.
- Cons: unusual (no app above does it); grows with every Ollama model, so it needs to list only checked models; a radio grid reads as a form, less calm than two pickers.

## 6. Open questions for the owner
- Do we pre-select from detection (Ollama running → local first), or always lead with ChatGPT?
- In Settings, does choosing a not-yet-checked model in a picker run the check immediately, or only models already checked appear?
- Labels: "My ChatGPT plan / A model on this computer / An API key or other server" vs product names ("ChatGPT", "Ollama", "API key").
