# 02: CI on macOS, Windows and Linux

**What to build:** Every push and pull request runs typecheck, lint (including the layering test), the unit tests and the end-to-end tests on macOS, Windows and Linux, so a cross-platform break fails the build. End-to-end tests run the real Electron app headlessly on each OS (Linux under a virtual display).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A GitHub Actions workflow runs on push and pull request with a matrix of macOS, Windows and Linux runners
- [ ] Each runner installs with the pinned pnpm and Node versions and runs typecheck, lint, unit tests and end-to-end tests
- [ ] End-to-end tests pass on all three runners (Linux under a virtual display)
- [ ] Playwright traces or screenshots are uploaded as artifacts when an end-to-end test fails
- [ ] The workflow uses no secrets and no network beyond installing dependencies

Spec: `.scratch/v0-1/spec.md`.
