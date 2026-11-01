# 02: Many key providers by name

Spec: `.scratch/v0-1-1/spec.md` · ADR 0021

**What to build:** Key-only providers from pi-ai's catalog join the API keys group: DeepSeek, Mistral, xAI, Groq, Moonshot, Together, Fireworks, Cerebras, Hugging Face, Vercel AI Gateway, and others whose pi-ai provider takes a plain key. Each uses the saved-key-only auth (no environment variables, no other tools' files). Kimi and MiniMax plans are not named (ADR 0021). Each row links to where to get a key.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each provider sends only the saved key; a test proves none reads the environment
- [ ] Each appears in search and in the slot pickers once connected
- [ ] The model list starts on a sensible default where one is named
