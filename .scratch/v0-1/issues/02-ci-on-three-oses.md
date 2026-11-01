# 02: CI on macOS, Windows and Linux

**What to build:** Every push and pull request runs typecheck, lint (including the layering test), the unit tests and the end-to-end tests on macOS, Windows and Linux, so a cross-platform break fails the build. End-to-end tests run the real Electron app headlessly on each OS (Linux under a virtual display).

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-01: green on macOS, Windows and Linux, https://github.com/crasni/interviewharness/actions/runs/41302440371)

- [x] A GitHub Actions workflow runs on push and pull request with a matrix of macOS, Windows and Linux runners
- [x] Each runner installs with the pinned pnpm and Node versions and runs typecheck, lint, unit tests and end-to-end tests
- [x] End-to-end tests pass on all three runners (Linux under a virtual display)
- [x] Playwright traces or screenshots are uploaded as artifacts when an end-to-end test fails
- [x] The workflow uses no secrets and no network beyond installing dependencies

Spec: `.scratch/v0-1/spec.md`.

## What the first runs found (2026-11-01)

All in the tests, none in the app:
- Windows gives every timer a minimum delay, so a scripted silence of thousands of `setTimeout(0)` ticks ran past vitest's limit. The scripted-candidate test now yields with `setImmediate`.
- Tests read `settings.json` straight after a change; it's written a moment later. They poll now.
- Chromium writes browser storage to disk lazily; the v0.0 carry-over test now flushes it before closing.
- macOS uses ⌘ for shortcuts (`ControlOrMeta` in tests), and always shows its menu bar (with Electron's own Develop menu in an unpackaged build), so the menu test checks only that there's no File or View menu.

