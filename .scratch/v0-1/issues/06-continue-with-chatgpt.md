# 06: Continue with ChatGPT, and the first-run model step

**What to build:** The first real provider. A new **providers** package wraps pi-ai (pinned to an exact version, ADR 0016) behind the engine's model interface; the layering lint rule and its test are extended for it. A **credential store** encrypts with async safeStorage (only after the app is ready) into a credentials file in the data folder, written atomically; on Linux with the `basic_text` backend it saves anyway with owner-only permissions and shows a one-time note that the login isn't encrypted here; a "temporarily unavailable" keyring is retried, never wiped. pi-ai's lookup of environment variables and other tools' credentials is turned off. The Start screen won't start a round until a model is picked, and shows one short step with **Continue with ChatGPT** (OpenAI's sign-in for open-source local apps, branding per OpenAI's guidelines): it logs in through the browser, comes back by itself, and saves the choice in settings.json. Then the interviewer really talks through the candidate's ChatGPT plan. Nothing depends on `temperature`, which the plan rejects.

**Blocked by:** 03, 04

**Status:** done (the owner signed in with a real ChatGPT plan on 2026-10-30)

- [x] The providers package exists, depends on engine (not desktop), and the layering test proves it
- [x] With no model set, Start is blocked and the first-run step shows; after login a round can start
- [x] Continue with ChatGPT completes the browser login and returns to the app without copying codes
- [x] Credentials are encrypted with async safeStorage; the basic_text path saves with owner-only permissions and shows its note once
- [x] No environment variable or other tool's credential is ever read; no key or token reaches the renderer, a log or a round folder
- [x] Adapter tests run the login and chat streaming against a fake loopback server; credential store tests use a temp folder
- [x] Manually verified once against a real ChatGPT plan

Spec: `.scratch/v0-1/spec.md`.
