# 08: Ollama

**What to build:** Ollama on this machine is detected (default address `localhost:11434`, editable) and its installed models are listed, with capabilities and context length from Ollama's model details, both in the first-run step and in the Model tab. Requests go through Ollama's **native chat API**, never its OpenAI-compatible endpoint: every request sets the context size explicitly (large enough for the prompt) and turns thinking off. When Ollama isn't running, the candidate sees a plain message saying so and how to start it. Ollama models count as local for the small-model rule.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Ollama is found automatically when running, and its models are listed in both places
- [ ] Requests use the native chat API with an explicit context size and thinking off
- [ ] A stopped Ollama gives a plain message, not an error dump
- [ ] The model is checked to answer before the choice is saved
- [ ] Adapter tests against a fake loopback server cover listing, streaming, abort, errors and the request options
- [ ] Manually verified once with a real local model

Spec: `.scratch/v0-1/spec.md`.
