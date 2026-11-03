# 02: Settings → Voice and model downloads

**What to build:** A new Voice tab in Settings, after Interview, with the Microphone picker (the system default first, then the devices the system lists), "How you talk" (moved from Interview; Click to talk stays its only value), and the speech models that can be downloaded, each with its size: Download shows progress and can be cancelled; a finished model shows its size on disk and Remove; a failed download says so and offers Try again. Behind it: the **speech model table** (plain data like the key-provider table: id, kind, display name, size, pinned sherpa-onnx release address, checksum, licence, credit) with Moonshine v2 base, Parakeet TDT 0.6B v2 and Pocket TTS int8; the voice module's download half in main, free of Electron (download to a temporary name, check the checksum, unpack, rename into place, so a half-download is never used); a models folder in the data folder; and the new settings fields (speech to text slot, your speech models, the interviewer's voice as on/off/not yet asked, the voice, the speaking speed, the microphone) with a settings version bump whose migration only adds defaults.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Voice tab sits after Interview and scrolls inside its own area; "How you talk" is no longer on Interview
- [ ] The microphone choice is saved and survives a restart; a device that's gone falls back to the system default
- [ ] Download, progress, cancel, retry, finished size and Remove work for each model in the table
- [ ] A download whose checksum doesn't match, or that stops halfway, is never used and leaves nothing behind
- [ ] Removing a downloaded model deletes its folder and takes it out of your speech models
- [ ] Settings defaults, validation and the migration are tested; old settings files load unchanged apart from the new defaults
- [ ] The voice module's downloads are tested against a fake download server on loopback, with a temporary data folder
- [ ] End to end: the Voice tab saves the microphone and downloads a model from a fake download server

Spec: `.scratch/v0-2-0/spec.md`.
