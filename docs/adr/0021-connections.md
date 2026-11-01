# Connections: one list for every way to bring a model

The interviewer runs on "any model", and candidates arrive with very different access: a plan they pay for, an API key, a gateway, a model on their own computer or a server on their network. Research (`docs/research/13-keys-and-plans.md`, with the owner's own Jan as the reference) found six kinds of access and checked each against the vendor's terms. The owner decided on 2026-11-01.

## The decisions
- **Every source is a connection** in one list (Settings → Model): a kind, a short literal status, and its actions. Both model slots pick from every connection's models. Adding one is a **searchable list grouped by kind**: plans you pay for, sign in, API keys, on this computer or your network. Picking an item shows only its fields, and every add ends in the one-short-reply check before anything is saved. The Start screen's API key row opens the same list.
- **Many key providers by name**, from pi-ai's catalog (DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face, Vercel AI Gateway and more), each key-only and searchable.
- **Several named custom servers**, each **OpenAI- or Anthropic-compatible**, replacing the single "other server". This covers LM Studio, llama.cpp, vLLM, Jan's own server, LiteLLM and company gateways.
- **OpenRouter sign-in** next to pasting a key.
- **Plans whose terms are unclear for apps like ours (Kimi, MiniMax) are not named.** Anyone who wants them adds them as a custom server.
- **Plans we can't use don't appear at all**, not even in search. (The research suggested a one-line reason in search results; the owner chose to leave them out.)
- **Claude plans wait.** The only allowed route is the user's own `claude` CLI (AGENTS.md). Its speed will be measured after the voice work, once the Floor Manager has a measured budget.

## Refused
- A Claude plan login inside the app (Anthropic forbids it), Gemini AI Pro/Ultra via Gemini CLI credentials (Google forbids it and suspends accounts), Copilot via borrowed client ids, the legacy Codex login, SuperGrok and Meta logins (borrowed ids or private endpoints), and Z.ai and Qwen/Alibaba coding plans (limited to listed tools).
- Ambient credentials of any kind (ADR 0016): Bedrock and Vertex, if added, take a pasted key only.
