# Open questions for the owner

Decisions I couldn't settle alone while implementing v0.0. Each one lists the default I went with, so nothing is blocked. Answer, and I'll change course where needed.

## From ticket 01 (walking skeleton)

### Q1: Folder layout inside the desktop app
BLUEPRINT §6 puts main and preload in `apps/desktop/electron/` and the renderer in `apps/desktop/src/`. electron-vite's default is `src/main`, `src/preload`, `src/renderer`.
**Default taken:** electron-vite's layout (less config, matches its docs). BLUEPRINT §6 not yet updated.
**Your call:** keep it (I update §6), or move to the blueprint layout.

### Q2: Tooling picked during the scaffold
Not in DECISIONS.md or docs/adr/, so recording them here:
- **pnpm 10**, not 12: pnpm 12 doesn't start with the corepack bundled with Node 22. Pinned via `packageManager`.
- **TypeScript 6.0**, not 7: typescript-eslint doesn't support 7 yet.
- **electron-vite** for building main, preload and renderer together.
- **Vitest** for engine tests, **Playwright** for the Electron UI tests, **ESLint flat config** with a tested layering rule.
- **Electron 45** no longer downloads its binary on install, so the desktop package runs `install-electron` as a postinstall step.
**Your call:** fine as is, or want any of them as an ADR?

### Q3: Dev mode uses a local port
AGENTS.md says "no local HTTP port". The packaged app has none (it loads files, talks over IPC). But `pnpm dev` runs Vite's dev server on localhost for hot reload, as every electron-vite app does.
**Default taken:** allowed in dev only.
**Your call:** OK, or should dev also avoid it (slower, no hot reload)?

### Q4: Commits are local only
All work is committed to `main` but **not pushed**, so you can review the history first.
**Your call:** `git push` when happy.
