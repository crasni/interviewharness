# 06: Problem panel, editor and transcript

Spec: `.scratch/v0-0/spec.md`

**What to build:** The room's working surface. One original problem (no LeetCode text, CC BY 4.0) is loaded from a plain file into a collapsible left panel. The candidate writes code in a real CodeMirror editor in the mono black-and-white theme; typing in it counts as activity for the Floor Manager. Interviewer subtitles fade after a while, and a transcript drawer, opened with a shortcut, shows the whole conversation.

**Blocked by:** 01 (walking skeleton)

**Status:** ready-for-agent

- [ ] One original problem exists as a plain content file; the owner reviews its text
- [ ] The problem shows in a collapsible left panel
- [ ] CodeMirror editor with mono font and black-and-white theme; no code running
- [ ] Editor activity is sent to the engine as a signal
- [ ] Subtitles fade after a while
- [ ] A keyboard shortcut opens and closes a transcript drawer with the full conversation
- [ ] Playwright test: the problem is visible, and the editor accepts typing
