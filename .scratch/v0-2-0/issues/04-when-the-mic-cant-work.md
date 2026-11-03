# 04: When the mic can't work

**What to build:** Plain notices in the room's existing notice area whenever speaking can't work, each saying why and how to fix it, and each leaving typing working and the round going: the mic is blocked (with where to allow it on this OS: System Settings on macOS, Settings → Privacy on Windows, the desktop's sound settings on Linux); no microphone is found; the speech model download failed during the first-use prompt (with Try again); the speech engine won't load; Linux x64 with glibc older than 2.32 ("Local voice needs Ubuntu 22.04 or newer; Deepgram and typing still work"), where the engine isn't started at all; and turning a recording into text failed (nothing half-done is left in the box, so the candidate can say it again). Each failure is logged with a short reason, never audio.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Each failure shows its own notice, with the fix for the OS it's running on
- [ ] After any failure, typing and sending still work and the round carries on
- [ ] A failed turn-to-text leaves the box as it was before recording
- [ ] The old-Linux check refuses to start the engine and says so (tested in the voice module)
- [ ] Failures are logged with a short reason
- [ ] End to end: a blocked mic and a failed download each show their notice, and typing still works

Spec: `.scratch/v0-2-0/spec.md`.
