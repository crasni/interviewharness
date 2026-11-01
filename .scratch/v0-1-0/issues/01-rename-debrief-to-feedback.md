# 01: Rename Debrief to Feedback

**What to build:** Everywhere the candidate or a contributor sees "Debrief" now says **Feedback** (GLOSSARY): the screen after a round, its UI copy, its components and module names, and its end-to-end tests. Nothing behaves differently; the sample feedback still shows. Also add a `.gitattributes` with `* text=auto eol=lf`, so every OS checks the repo out with LF line endings.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The screen after a round is titled and labelled Feedback; no UI text says Debrief
- [x] Code identifiers, module names and end-to-end test names use Feedback; a search of the app and engine for "debrief" finds nothing
- [x] `.gitattributes` exists with `* text=auto eol=lf`, and the repo renormalises cleanly
- [x] Typecheck, lint, unit and end-to-end tests pass

Spec: `.scratch/v0-1-0/spec.md`.
