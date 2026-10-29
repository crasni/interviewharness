# UI direction: from "plain" to modern minimal

_2026-10-29. Why v0.0 looks plain, what ChatGPT, Claude and LearnHarness do instead, and a proposed direction. Nothing here is decided yet: the owner picks (see the end)._

## Why v0.0 looks plain

v0.0 took "black and white" literally: pure `#000` on `#fff`, 1 px black rules between every region, zero radius, no greys, state by full inversion, all-caps tracked labels everywhere. That reads as **brutalist**, not modern. Anthropic's own frontend-design skill names this exact combination as a default to avoid ("hairline rules, zero radius, dense columns"), and lists **all-caps tracked labels** as an AI-slop tell.

## What the reference apps do

**ChatGPT** (cool, pure neutrals)
- White or black canvas; primary text near-black `#0d0d0d`, secondary text mid-grey `#5d5d5d`.
- Regions separated by a slight background tint and space, not by rules.
- The composer is the hero: a **fully rounded** box (≈28 px radius) with a light `#e5e5e5` hairline; round 36 px buttons; the send button is the one solid black element.
- Hover is a 5–7 % black wash, not an inversion.
- Voice (since Nov 2025) lives **inside the conversation** with a live transcript; the full-screen orb became optional.
- Values from a third-party reconstruction, not OpenAI's source: https://www.assistant-ui.com/examples/chatgpt.md, https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/

**Claude** (warm neutrals)
- Warm off-white canvas (≈`#FAF9F5`), a sans for the UI and a serif for the assistant's words (Anthropic's brand: Styrene + Tiempos).
- Soft rounded composer (≈16 px), light warm borders, no shadows, a single terracotta accent.
- The warmth is Claude's identity, and the frontend-design skill lists cream + terracotta as a cliché to avoid copying.
- Sources: https://type.today/en/journal/anthropic, https://www.assistant-ui.com/examples/claude.md (third-party)

**LearnHarness** (from its `app/globals.css`)
- **Dark** monochrome with greys: page `#141414`, raised `#1C1C1C`, edges `#434343`, muted text `#8D8D8D`, text `#E6E6E6`. No pure black, no pure white.
- Radius ladder 4 / 8 / 12 / 16 px (default 8). Tailwind's 4 px spacing scale, a declared type ladder (11 → 32 px) with line heights.
- Three fonts by role: JetBrains Mono for UI chrome, Source Sans 3 for reading, CMU Serif for titles.
- One coloured element: a green primary button in the composer.

## What makes minimal feel modern (sources)

- **A grey ramp with roles** (Vercel Geist): ~10 steps, each with a job: background, hover, active, border, hover border, secondary text, primary text. Borders are a *light* step, not the darkest. https://vercel.com/geist/colors
- **Fewer borders** (Refactoring UI): separate with space, a background tint or a soft shadow; if a border is needed, make it light. https://www.refactoringui.com/
- **Less noise, more hierarchy** (Linear's redesign): neutral, timeless; built mostly from black and white at different opacities; display vs text cuts of one family. https://linear.app/now/how-we-redesigned-the-linear-ui
- **Agent design rules** (Anthropic frontend-design skill): a written token plan reviewed against "what would a generic page look like"; 4–6 named colours; one or two type families on a deliberate scale; motion only to show what changed; visible focus; plain sentence-case copy. Avoid gradients, glass, one radius on everything, the same shadow on every card, all-caps eyebrows, middle-dot meta strings. https://github.com/anthropics/claude-plugins-official/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
- **DESIGN.md** (Google Stitch): one file of tokens plus the reasons, read by agents next to AGENTS.md. https://the-decoder.com/googles-open-source-design-md-gives-ai-agents-a-prompt-ready-blueprint-for-brand-consistent-design/

## Proposed direction (for the owner to decide)

Keep the soul (monochrome, no slop, hierarchy from type and space), drop the brutalism:

1. **Monochrome with a neutral grey ramp**, not pure black and white. Cool neutrals (ChatGPT's route) stay closest to "black and white"; warm would read as Claude.
2. **Light hairlines or tints instead of black rules.** The room's regions (problem, editor, presence strip) are separated by surface tone and space.
3. **Radius by role:** small for controls, larger for panels, a fully rounded "presence bar" at the bottom (the room's composer).
4. **Inversion only for the one primary action** (e.g. "Start coding round", "Move on"); hover is a faint wash.
5. **Sentence-case labels** instead of all-caps tracked ones; secondary grey text for metadata.
6. **Voice and presence inside the room**, quiet (a dot or small waveform + live transcript), as ChatGPT moved to in 2025, which fits "an interviewer that listens".
7. **One soft shadow** at most, for floating layers (the transcript drawer, menus).
8. **Write the result down as tokens** (our `tokens.css` already is that; optionally a root `DESIGN.md` with the reasons).

Open choices: light, dark or both; cool or warm neutrals; whether to bring in a design skill (Anthropic's `frontend-design` plugin) for the polish work; whether to compare 2–3 variations side by side before committing.
