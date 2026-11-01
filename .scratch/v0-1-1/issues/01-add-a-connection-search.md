# 01: Add a connection is a searchable list

Spec: `.scratch/v0-1-1/spec.md` · ADR 0021

**What to build:** Add (Settings → Model) and the Start screen's API key row open one searchable list grouped by kind: "Plans you pay for" (ChatGPT), "Sign in" (OpenRouter, once 04 lands), "API keys" and "On this computer or your network" (Ollama, custom servers). Picking an item shows only its fields and one button that checks and saves. Typing filters across every group. Plans the app can't use (Gemini AI Pro/Ultra, Claude in-app login, Z.ai and Qwen coding plans, Copilot) don't appear at all, not even in search (ADR 0021).

**Blocked by:** None

**Status:** done

- [x] One list in both places, grouped by kind, searchable, keyboard-usable
- [x] Picking an item shows only its fields; the button checks and saves
- [x] Refused plans never appear, in the list or in search
- [x] The list scrolls inside its own region; the screen stays full height
- [x] End-to-end tests cover search, picking, and the Start screen path
