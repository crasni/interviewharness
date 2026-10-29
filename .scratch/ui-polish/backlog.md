# UI polish backlog

Owner's notes after trying the Editorial identity (2026-10-29). **Not started: wait for the owner's go.** When starting, grill the open questions first, then turn them into tickets in this folder with `/to-tickets`.

## 1. Corners are too rounded
Cards and the composer use 16 px, buttons and the bubble are full pills. Tone it down. Values live in `apps/desktop/src/renderer/src/ui/tokens.css` (`--radius-*`); compare a few side by side.

## 2. The interview interface needs a proper interaction design pass
Open questions, to settle with a grilling session and a prototype:
- **Transcript at the bottom:** show the conversation inline at the bottom, or keep it in a drawer; toggle on/off?
- **How the candidate talks:** click to talk (now), speech detection (talks when you speak, v0.2 mic), or both as a setting.
- **Font sizes** in the room: the interviewer's line, the candidate's words, the problem.
- **The interviewer's presence as a floating tile**, bottom right, like a Zoom self-view but showing an AI circle instead of a face, in the spirit of ChatGPT's voice circle: a rounded rectangle with an animated circle that listens, nods and speaks. It would replace or complement the small dot.

## 3. Customisation (future plan, after v0.0)
- Resize the panels (problem, editor, exchange).
- A settings area so candidates tailor their rounds: code language, autocomplete on/off, syntax highlighting, and more.

## 4. Font research
Briefly research the best fonts for this product: tech, intuitive, clean, stylish, AI-era. Compare against today's Geist / Newsreader / Geist Mono and suggest options. (Today's interface font is Geist, bundled with the app; `system-ui` is only the fallback.)
