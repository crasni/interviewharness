# 09: Six-platform smoke test in CI

**What to build:** The prototype's check (branch `prototype/voice-engines`), rebuilt on the real speech utility process: in CI, on Linux, macOS and Windows, each on x64 and arm64, the built app starts its speech process, loads Moonshine and Pocket TTS, turns a short clip into text and speaks a line, and reports the timings. Real models are downloaded only here, never in unit or end-to-end tests. It runs on pushes and pull requests like the rest of CI.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] A CI job per target (Linux x64 and arm64, macOS arm64 and x64, Windows x64 and arm64) runs the real speech process and passes
- [ ] It fails if the engine doesn't load, the clip isn't turned into text, or the line produces no audio
- [ ] Timings are printed in the job's log
- [ ] Model downloads are cached between runs where the platform allows

Spec: `.scratch/v0-2-0/spec.md`.
