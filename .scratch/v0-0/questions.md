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

## From ticket 02 (design tokens and presence dot)

### Q5: Fonts
BLUEPRINT §4 names options, not a final pick.
**Default taken:** **Geist** for the UI and **JetBrains Mono** for code, both OFL-licensed and bundled with the app (no network font loading).
**Your call:** keep, or swap (Inter Display, Geist Mono, Berkeley Mono if you own a licence).

### Q6: The recording colour
**Default taken:** `--recording: #e10600` (a clean red). Defined but not shown anywhere yet: nothing records in v0.0, so the "● REC" mark from the blueprint mock is left out rather than shown falsely.
**Your call:** colour OK? Show REC once the mic arrives (v0.2)?

### Q7: Disabled look
Strict black and white leaves no grey for "disabled".
**Default taken:** disabled buttons get a **dashed** border; hover/focus/pressed is **inverted** (black fill, white text).
**Your call:** OK, or prefer another cue?

### Q8: The speaking state
**Default taken:** while speaking, the dot holds still and a small 5-bar waveform appears beside it (BLUEPRINT §4: "shows a waveform while speaking"). Listening = slow breathing; nod = one quick pulse.
**Your call:** judge it in `pnpm dev` with the dev-only buttons in the room's bottom-right.

### Q9: Where renderer code lives
Renderer code is split into `ui/` (design system: tokens, base, presence dot), `room/`, `start/`, plus `rounds.ts` for round/phase labels. BLUEPRINT §6 lists `room/` and `ui/` but not `start/`, and puts presence under `room/`.
**Default taken:** the dot is a design-system primitive, so `ui/`. Fold into Q1 when you update §6.

## From ticket 03 (hold Space and backchannels)

### Q10: Backchannel timing
**Defaults taken** (engine `floorRules`, within BLUEPRINT §3.3's ranges):
- backchannel after **800 ms** of silence mid-turn
- at most one every **8 s**
- no backchannel if the candidate talked less than **1 s** (a tap isn't something said). This rule is mine, not from the docs.
- each pause is weighed once: if the cooldown blocks it, that pause gets nothing, even after the cooldown ends.
**Your call:** tune these by feel in `pnpm dev`; they are one object in `packages/engine/src/floor-manager.ts`.

### Q11: What goes into events.jsonl
**Default taken:** every candidate signal (talk start/end) is logged with the decision and state. Ticks run 10×/s, so a tick is only logged when it weighs a pause (a backchannel, or a deliberate silence because of the cooldown or a tap). Each entry carries `talkMs`, `silenceMs` and `sinceBackchannelMs`, so "why did it stay quiet?" is answerable. BLUEPRINT §5.3 updated to say so (and to use `rounds/`, not `sessions/`).
**Your call:** OK, or log every tick?

### Q12: UI tests run in a hidden window
At your request, the Playwright tests launch the app with its window hidden (`INTERVIEWHARNESS_HIDDEN_WINDOW=1`) and background throttling off, so nothing pops up. Nothing to decide; noting it so it isn't a surprise.
