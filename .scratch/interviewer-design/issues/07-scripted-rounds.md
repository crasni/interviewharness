# 07: A few scripted rounds to try the interviewer on a real model

**What to build:** A small script the owner runs by hand that plays a few scripted candidates through full rounds on a real model and saves the transcripts to read.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Five or so scripted candidates: silent for long stretches, stuck and saying so, buggy and asking for help, finishing early, working through everything unprompted
- [x] Runs on the existing public Interviewer and model interfaces, against whatever model is configured; saves each transcript and the model used
- [x] Never runs in CI and needs no new dependencies
- [x] A short note says what to look for: the interviewer speaking when it didn't need to, hints given unasked, repeated questions

Spec: `.scratch/interviewer-design/spec.md` (the owner clarification at its top wins over anything below it).

Done: `pnpm scripted-rounds [--only <names>] [--out <folder>]` runs `apps/desktop/scripts/scripted-rounds.ts` (through Vite's `runnerImport`, since this Node has no TypeScript support; Vite is already a dependency). The candidates are in `scripted-candidates.ts`; the player that drives the public Interviewer (round time runs ahead freely, and keeps pace with real time while the model is waited on) is `packages/engine/src/test/scripted-candidate.ts`, tested with the scripted fake model. Transcripts go to `~/interviewharness-scripted-rounds/<time>/`, outside the repo: `<name>.md` to read, `<name>.json` with the record and log, and `index.md` with the model and the note on what to look for. The model is `INTERVIEWHARNESS_MODEL`, else the app's settings, else the default. The app's saved login is encrypted by Electron, so the script signs in to ChatGPT in the browser each run and keeps the login in memory only.
