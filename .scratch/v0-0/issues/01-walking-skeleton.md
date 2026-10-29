# 01: Walking skeleton: start a round and see the room

Spec: `.scratch/v0-0/spec.md`

**What to build:** The thinnest end-to-end path through the app. The candidate opens the app, sees the start screen, clicks "Start coding round", and lands in an empty interview room whose top bar shows the round type, the current phase (Clarify) and an elapsed-time timer. The phase and time come from the engine running in the main process, over IPC.

This also lays the foundation every later ticket uses: the monorepo (pnpm workspaces + Turborepo) with only the desktop app, `core` and `engine`; lint that enforces the layering (core ← engine ← app); and test tooling at both seams.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] One command installs, and one command runs the Electron app in dev
- [x] Start screen lists the coding round (enabled) and the system design and AI-assisted rounds (disabled, marked as later)
- [x] Starting a coding round opens the room; the top bar shows round type, phase "Clarify" and a running timer
- [x] The engine runs in the main process; the renderer talks to it over IPC only (no local HTTP port)
- [x] The engine takes an injected clock; a test advances a fake clock and checks the elapsed time it reports
- [x] A lint rule fails if `core` imports from `engine`/the app, or `engine` imports from the app
- [x] One Playwright test launches the Electron app, starts a coding round and sees the room
- [x] Tests run with no network
