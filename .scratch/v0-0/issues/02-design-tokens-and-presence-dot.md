# 02: Design tokens and the presence dot

Spec: `.scratch/v0-0/spec.md`

**What to build:** The black-and-white design system, applied to the start screen and room, and the interviewer's presence dot with its three looks. Hierarchy from type weight, size and space; state by inversion; one signal colour for "recording". No gradients, glass, or stock component-library look.

The presence dot has three states: breathing (listening), nod (a brief pulse for a backchannel), and speaking. Until the Floor Manager drives it, the states can be triggered by hand (e.g. a dev-only control) to judge the look.

**Blocked by:** 01 (walking skeleton)

**Status:** done

- [x] Design tokens defined once: type scale (grotesk UI font, mono code font), 4 px spacing grid, black/white, one recording colour
- [x] Start screen and room use only the tokens (no one-off colours or spacings)
- [x] Presence dot breathes while listening, nods on a backchannel, and shows a distinct speaking state
- [x] The dot's state can be set by hand in dev builds
- [x] No hint counter, score or budget anywhere in the room
