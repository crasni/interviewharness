# v0.1c: connections

Status: ready-for-agent

Decisions: ADR 0021 (and ADR 0016 for pi-ai, the provider order and no ambient credentials). Research: `docs/research/12-model-picker-patterns.md` (layouts) and `docs/research/13-keys-and-plans.md` (every kind of access, what's allowed, Jan in depth). v0.1c comes before v0.1b's problems (owner, 2026-11-01).

## Problem Statement

A candidate can already bring a model four ways: their ChatGPT plan, Ollama on their computer, an API key for OpenAI, Anthropic, Google or OpenRouter, or one OpenAI-compatible server. But candidates arrive with much more varied access. Some pay for DeepSeek, Mistral, xAI or Groq. Some run several local servers (LM Studio, llama.cpp, Jan's own server, a company gateway), some of them speaking Anthropic's format rather than OpenAI's. Some would rather sign in to OpenRouter than copy a key.

And the more a candidate connects, the worse picking a model gets. The Interviewer and Feedback pickers list every model of every connection, so connecting OpenRouter alone puts over 400 models in front of them, most of which they'll never use and none of which has been checked to answer.

## Solution

v0.1c turns model access into **connections** and **your models**:

- **Connections** stay one list in Settings → Model: each with a short literal status and its actions. **Add** opens one searchable list grouped by kind: "Plans you pay for", "Sign in", "API keys" and "On this computer or your network". Picking an item shows only its fields; one button checks that a model answers and saves. The Start screen's API key row opens the same list.
- **Many key providers by name**: DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face, Vercel AI Gateway and others pi-ai supports with a plain key.
- **Several named servers**, each OpenAI- or Anthropic-compatible, with an optional key.
- **Sign in to OpenRouter** through the browser, besides pasting a key.
- **Your models**: the pickers list only the models you've added, each checked to answer when it was added, with the connection it comes from. "Add a model…" searches every connection's full catalog.
- Plans the app can't use (a Claude plan login, Gemini AI Pro/Ultra, Z.ai and Qwen coding plans, Copilot through borrowed logins) don't appear anywhere. Plans with unclear terms (Kimi, MiniMax) aren't named; they can be added as a server.

## User Stories

### Your models
1. As a candidate, I want the Interviewer model picker to list only the models I've added, so that I pick from a short list I chose rather than hundreds of models.
2. As a candidate, I want each model in the picker to show the connection it comes from ("GPT-6.1 Sol · ChatGPT"), so that I can tell two similar models apart.
3. As a candidate, I want every model in my list to have answered a check when it was added, so that picking from the list never leads to a round that can't start.
4. As a candidate, I want "Add a model…" at the end of the picker, so that I can reach any model from any connection without leaving the picker.
5. As a candidate, I want "Add a model…" to search every connection's full catalog at once, so that I can find a model by name without knowing which provider lists it.
6. As a candidate, I want a model I add from the picker to become that picker's choice once it answers, so that adding and choosing is one step.
7. As a candidate whose model doesn't answer, I want a plain reason and my list left unchanged, so that a typo or a model I can't use doesn't clutter my list.
8. As a candidate, I want the Feedback model picker to list the same models plus "Same as interviewer", so that I can pick a stronger grader from models I already have.
9. As a candidate, I want to remove a single model from my list, so that it stays tidy as I try models.
10. As a candidate, I want removing the model in use to clear that slot (and the Start screen to ask for a model again if it was the interviewer's), so that nothing points at a model I removed.
11. As a candidate upgrading from v0.1, I want my current interviewer and Feedback models to become my first models, so that nothing resets.
12. As a candidate, I want the model I check when adding a connection to join my list, so that a new connection is ready to use at once.

### Connections
13. As a candidate, I want one list of everything I'm connected to, each with a short status ("Signed in", "Key saved", "Running · 3 models", "Not answering"), so that I can see at a glance what works.
14. As a candidate, I want Add to open one searchable list grouped by kind, so that I find a provider by name or by the kind of access I have.
15. As a candidate, I want picking an item to show only that item's fields, so that adding one provider never shows me the others' forms.
16. As a candidate, I want every add to end with one button that checks a model answers and only then saves, so that a wrong key or a stopped server is caught at once.
17. As a candidate, I want removing a connection to forget its key or login and remove its models from my list, so that nothing of it is left behind.
18. As a candidate, I want to replace a saved key without removing the connection, so that rotating a key keeps my models.
19. As a candidate, I want the Start screen's API key row to open the same searchable list, so that first run and Settings work the same way.
20. As a candidate, I want the Add list and Settings to scroll inside their own regions, so that the screen never grows past the window.
21. As a candidate who searches for a plan the app can't use, I want it simply not to be there, so that the list only offers what works.

### Key providers
22. As a candidate with a DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face or Vercel AI Gateway key, I want to find that provider by name and paste my key, so that I can use what I already pay for.
23. As a candidate, I want each key provider to link to where its keys are made, so that I can get one without searching the web.
24. As a candidate, I want the app never to read a key from my environment or another tool, so that it only uses what I entered.
25. As a candidate, I want a key only ever stored in my OS's credential store and never shown back, so that it stays private.
26. As a candidate on Linux with no keyring, I want to be told once that my key isn't encrypted on this machine, so that I know the risk.

### Servers
27. As a candidate running LM Studio, llama.cpp, vLLM or Jan's server, I want to add it by name and address, so that any local model works.
28. As a candidate with more than one server, I want each to be its own connection with its own name, so that I can keep a home server and a work gateway apart.
29. As a candidate whose server speaks Anthropic's format, I want to choose that format when adding it, so that Anthropic-compatible gateways work too.
30. As a candidate, I want a server's models fetched from the server with the key I just entered, so that I see what it really serves.
31. As a candidate whose server doesn't list its models, I want to type a model id, so that I can still use it.
32. As a candidate, I want server errors to name the field to fix ("The address usually ends in /v1"), so that I can fix it myself.
33. As a candidate, I want to edit a server's address, key or format, and refresh it, so that a moved server doesn't mean starting over.
34. As a candidate upgrading from v0.1, I want my one saved server to become a named server, so that nothing resets.
35. As a candidate with a Kimi or MiniMax plan key, I want to add it as a server, so that I can use it at my own judgement even though the app doesn't name it.

### OpenRouter sign-in
36. As a candidate with an OpenRouter account, I want to sign in through my browser instead of copying a key, so that connecting takes one click.
37. As a candidate, I want the sign-in to come back to the app by itself, so that I don't copy codes around.
38. As a candidate, I want cancelling the sign-in to save nothing, so that I can back out safely.

### The owner and contributors
39. As the owner, I want every check and every model call logged with its provider and model and never a key, so that I can debug without leaking credentials.
40. As a contributor, I want each provider tested against a fake server on loopback, so that tests need no network or keys.
41. As a contributor, I want the list of key providers to come from one table, so that adding a provider is one entry, not edits across the app.

## Implementation Decisions

### Seams (agreed with the owner)
- **The providers package** (its `Providers` interface) grows: more key providers, named servers in two formats, OpenRouter sign-in. Tested against fake servers on loopback.
- **Main's model chooser** (already free of Electron) grows into the connections module: adding, replacing and removing connections; adding and removing your models; the check before anything is saved; migrating v0.1 settings. Tested with the real providers against the fakes and an in-memory settings store and credential store.
- **End-to-end tests** for the screens.

### Providers
- **One table of key providers**: our name, display name, pi-ai provider, where keys are made, and the default model where one is named. Each is registered with saved-key-only auth (no environment variables, no other tools' files). Only providers whose pi-ai auth is a plain API key qualify; none with subscription or borrowed-login flows.
- **Named servers**: a server has an id, a name, an address, an API format (OpenAI-compatible, through pi-ai's Chat Completions API; or Anthropic-compatible, through pi-ai's Anthropic Messages API) and an optional key. Each server's key is stored under its own credential id. A server's models are listed from its own models endpoint; a typed id is accepted when listing isn't available.
- **OpenRouter sign-in** uses OpenRouter's official PKCE flow (as pi-ai implements it) with a loopback redirect; only OpenRouter's own sign-in page may be opened. The key it issues is stored like a pasted one.
- `ProviderName` becomes the providers in the key table plus `chatgpt`, `ollama` and `server`; a `ModelChoice` for a server carries the server's id.

### Your models and settings
- settings.json gains **your models**: an ordered list of model choices, each added after a successful check. The interviewer and Feedback slots must be one of your models (Feedback may also be "Same as interviewer").
- settings.json's **servers** become a list (id, name, address, format); the single v0.1 server address migrates to one server named after its host. Credentials never enter settings.json.
- A settings version bump with a migration: the picked interviewer and Feedback models become your models; the old server becomes a named server.
- Removing a connection removes its models from your models and clears any slot using one.

### IPC
- The renderer's narrow surface grows to: list connections with status; list a provider's or server's catalog (optionally through a key or address not saved yet); search every connection's catalog for "Add a model…"; add a connection (checked); add a model to your models (checked, optionally into a slot); remove a model; remove a connection; replace a key; add, edit and remove a server; start and cancel OpenRouter sign-in. Main validates every request, as it does now.

### Screens
- **Settings → Model:** the two pickers (your models, with their connection; "Add a model…" last), the small-model switch, then Connections with Add on its heading. Add opens the grouped searchable list in a well under Connections; an item's fields replace the list; Cancel returns.
- **Start screen:** the three rows stay (ChatGPT, Ollama, API key); the API key row opens the same grouped list, filtered to keys and servers.
- The pickers and lists use the app's own Picker. Everything scrolls inside its region (full-height screens).
- Refused plans are absent from every list and search (ADR 0021).

## Testing Decisions

- Good tests check behaviour from outside: what the providers send and return, what the connections module saves and refuses, and what the screens show and save. Never prompt wording, internal calls or component structure. Deterministic, with fake servers on loopback; no network, no keys.
- **Providers** (prior art: the Ollama and key-provider tests with their fake servers): every key provider sends only the saved key and fails as auth on a rejected one, with nothing read from the environment; servers in both formats stream, give structured replies and list models; OpenRouter sign-in completes, comes back by itself, can be cancelled, and saves nothing on failure.
- **Connections module** (prior art: the model chooser tests): a model joins your models only after it answers; adding a connection adds its checked model; removing a connection forgets its credential and its models and clears slots; replacing a key keeps your models; a refused key leaves the old one; server errors name the field; v0.1 settings migrate.
- **End-to-end** (prior art: the model-step and Model tab specs with fake Ollama and key servers): the grouped Add list searches and opens one item's fields; "Add a model…" adds a model from search and picks it; a model that doesn't answer isn't added; removing a model or a connection updates the pickers; the Start screen path; a named Anthropic-format server end to end.
- The layering lint and its test keep pi-ai inside providers and only types from providers in the renderer.

## Out of Scope

- A Claude plan through the user's own `claude` CLI: after v0.2, once replies have a measured time budget (ADR 0021).
- Copilot through GitHub's official SDK, Azure, Bedrock and Vertex.
- Naming Kimi, MiniMax or other plans with unclear terms; showing refused plans with reasons.
- Favourites, recently used, and suggested-model lists in the pickers.
- Several connections of the same named provider (two OpenAI keys); only servers can repeat.
- Model quality guidance (which models make good interviewers): that needs the eval work.

## Further Notes

- Today's code already has the pieces this builds on: saved-key-only auth, the one-short-reply check with plain errors, the Picker, the RefreshButton, the three-row setup and the Connections list.
- Docs to update alongside: ADR 0021 if anything here changes it; GLOSSARY (connection, your models); STATUS (v0.1c before v0.1b); BLUEPRINT's roadmap.
