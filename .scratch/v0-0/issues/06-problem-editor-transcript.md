# 06: Problem panel, editor and transcript

Spec: `.scratch/v0-0/spec.md`

**What to build:** The room's working surface. One original problem (no LeetCode text, CC BY 4.0) is loaded from a plain file into a collapsible left panel. The candidate writes code in a real CodeMirror editor in the mono black-and-white theme; typing in it counts as activity for the Floor Manager. Interviewer subtitles fade after a while, and a transcript drawer, opened with a shortcut, shows the whole conversation.

**Blocked by:** 01 (walking skeleton)

**Status:** ready-for-human (only the owner's review of the problem text is left; see questions.md Q21)

- [x] One original problem exists as a plain content file
- [ ] The owner reviews its text
- [x] The problem shows in a collapsible left panel
- [x] CodeMirror editor with mono font and black-and-white theme; no code running
- [x] Editor activity is sent to the engine as a signal
- [x] Subtitles fade after a while
- [x] A keyboard shortcut opens and closes a transcript drawer with the full conversation
- [x] Playwright test: the problem is visible, and the editor accepts typing
