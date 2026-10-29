# 05: Two sum in the problem folder format

**What to build:** Two sum moves into the problem folder format that v0.1b's problems will follow: one folder per problem holding the candidate-facing statement, the problem's details (title, pattern, difficulty, license CC BY 4.0, credits), interviewer notes with a three-rung hint ladder (nudge, question, concrete) and follow-ups, a Python reference solution, and test cases with ids. Everything is in our own words. The room's problem panel reads the statement from the folder, and the interviewer's prompt now includes the interviewer notes and the full reference solution, marked never to be revealed. Content readers accept CRLF line endings, and problem names are checked against names Windows reserves and against case-only clashes.

**Blocked by:** 04

**Status:** done

- [x] Two sum lives in its own folder with the five parts; the old single-file version is gone
- [x] The problem panel shows the same statement as before, read from the new folder
- [x] The interviewer prompt includes the notes, hint ladder and reference solution
- [x] Content readers accept LF and CRLF; a check rejects reserved Windows names, invalid characters and case-only clashes
- [x] Tests cover loading, CRLF and the name checks

Spec: `.scratch/v0-1/spec.md`.
