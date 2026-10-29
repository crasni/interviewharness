# 09: API keys and other OpenAI-compatible servers

**What to build:** The candidate can paste an API key for **OpenAI, Google or OpenRouter** (pi-ai's providers) or **Anthropic** (our own provider, API keys only, because pi-ai's built-in one registers the Claude consumer login, which we never use), or enter the address of any **OpenAI-compatible server** (LM Studio, llama.cpp, vLLM) with an optional key. The model is checked to answer before the choice is saved. Keys go to the credential store.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] All five options appear in the first-run step and the Model tab
- [ ] The Anthropic provider accepts API keys only; no Claude consumer login code is registered or reachable
- [ ] A wrong key or unreachable server is caught at setup with a plain message
- [ ] Keys are stored only in the credential store and never shown back in full
- [ ] Adapter tests against a fake loopback server cover each request shape and the error paths

Spec: `.scratch/v0-1/spec.md`.
