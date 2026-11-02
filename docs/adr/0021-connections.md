# Connections: one list for every way to bring a model

The interviewer runs on "any model", and candidates arrive with very different access: a plan they pay for, an API key, a gateway, a model on their own computer or a server on their network. Research (`docs/research/13-keys-and-plans.md`, with the owner's own Jan as the reference) found six kinds of access and checked each against the vendor's terms. The owner decided on 2026-11-01.

## The decisions
- **Every source is a connection** in one list (Settings → Model): a kind, a short literal status, and its actions. Both model slots pick from every connection's models. Adding one is a **searchable list grouped by kind**: plans you pay for, sign in, API keys, on this computer or your network. Picking an item shows only its fields, and every add ends in the one-short-reply check before anything is saved. The Start screen's API key row opens the same list.
- **The model pickers list only your models**: the ones you've added, each already checked to answer, with the connection it comes from. Their last item, "Add a model…", searches every connection's full catalog and adds the pick after its check. A connection with hundreds of models (OpenRouter) never floods the pickers. Removing a connection removes its models. (Considered: favourites and recent on top of every model, as in Jan and Zed; a suggested short list with "Show all".)
- **Many key providers by name**, from pi-ai's catalog (DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face, Vercel AI Gateway and more), each key-only and searchable.
- **Several named custom servers**, each **OpenAI- or Anthropic-compatible**, replacing the single "other server". This covers LM Studio, llama.cpp, vLLM, Jan's own server, LiteLLM and company gateways.
- **OpenRouter sign-in** next to pasting a key.
- **Plans whose terms are unclear for apps like ours (Kimi, MiniMax) are not named.** Anyone who wants them adds them as a custom server.
- **Plans we can't use don't appear at all**, not even in search. (The research suggested a one-line reason in search results; the owner chose to leave them out.)
- **Claude plans wait.** The only allowed route is the user's own `claude` CLI (AGENTS.md). Its speed will be measured after the voice work, once the Floor Manager has a measured budget.

## Refused
- A Claude plan login inside the app (Anthropic forbids it), Gemini AI Pro/Ultra via Gemini CLI credentials (Google forbids it and suspends accounts), Copilot via borrowed client ids, the legacy Codex login, SuperGrok and Meta logins (borrowed ids or private endpoints), and Z.ai and Qwen/Alibaba coding plans (limited to listed tools).
- Ambient credentials of any kind (ADR 0016): Bedrock and Vertex, if added, take a pasted key only.

## Choices made while building it (v0.1.1)
- **OpenRouter's sign-in key is kept as an `oauth` credential**, though it's a plain API key. That's how the app tells a signed-in OpenRouter ("Signed in", Sign out) from a pasted key ("Key saved", Replace).
- **A model is removed from your models with a × beside it in the picker**, not from a separate list.
- **Picking one of your models doesn't check it again**: it answered when it was added.
- **Removing the Feedback model sets Feedback to "Same as interviewer"**, rather than leaving it empty.
- **A connection added in Settings picks its model for the interviewer only when none is picked yet**; otherwise it just joins your models. The Start screen's first-run setup always picks it for the interviewer. Replacing a key changes neither your models nor the picks.
