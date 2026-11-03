# 08: Voices and speed

**What to build:** In Settings → Voice: a Voice picker with the few CC0 voices from the voices table (each clip downloaded when first picked), a Speaking speed slider from 0.75× to 1.5× in steps of 0.25× starting at 1×, and a button that plays a sample line in the chosen voice at the chosen speed. Pocket TTS ignores the engine's own speed setting (found in the prototype), so the renderer plays faster or slower with the pitch kept. The Floor Manager's speaking time becomes the audio's length divided by the speed. A credit line under the voice picker credits Kyutai's Pocket TTS (CC BY 4.0) and the voice's donor licence.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Each voice can be picked, previewed and used in a round
- [ ] The speed slider has the five steps and is saved; playback keeps the pitch at every step
- [ ] The floor is held for the audio's length divided by the speed (Floor Manager test)
- [ ] The sample button plays the chosen voice at the chosen speed
- [ ] The credit line names Pocket TTS, Kyutai and CC BY 4.0
- [ ] End to end: changing voice and speed is saved, and the next spoken line uses them (the fake engine records which voice)

Spec: `.scratch/v0-2-0/spec.md`.
