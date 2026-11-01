# 03: Several named custom servers, OpenAI- or Anthropic-compatible

Spec: `.scratch/connections/spec.md` · ADR 0021

**What to build:** "Other server" becomes any number of named servers. Each has a name, an address, an optional key, and an API format (OpenAI-compatible or Anthropic-compatible). Models are fetched from the server with the key just entered; a model id can also be typed. Each server is its own connection row (Refresh, Edit, Remove) and its own group in the slot pickers. The existing single server in settings.json migrates to a server named after its address.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Add, edit and remove several servers; each keeps its own key in the credential store
- [ ] OpenAI- and Anthropic-format servers both checked and used, tested against fake servers on loopback
- [ ] Errors name the field to fix (e.g. "The address usually ends in /v1")
- [ ] settings.json migrates the old single server
