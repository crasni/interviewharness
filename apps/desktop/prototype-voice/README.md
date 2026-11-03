# PROTOTYPE: voice engines (throwaway)

Not part of the app. Answers the questions ADR 0022 left for a prototype, before the v0.2.0 spec:

1. Does sherpa-onnx-node run inside an Electron utility process on all six targets? (`pnpm electron-check`, and the `Prototype voice` CI workflow)
2. How long does local speech to text take on a ~10 s answer, Moonshine v2 base vs Parakeet v2? (`pnpm start`)
3. Kokoro or Pocket TTS for the interviewer, by ear? (`pnpm start`, then open `out/index.html`)

```bash
cd apps/desktop/prototype-voice
pnpm install --ignore-workspace
mkdir -p models-PROTOTYPE-wipe-me && cd models-PROTOTYPE-wipe-me
B=https://github.com/k2-fsa/sherpa-onnx/releases/download
for u in asr-models/sherpa-onnx-moonshine-base-en-quantized-2026-02-27 asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8 tts-models/kokoro-int8-multi-lang-v1_0 tts-models/sherpa-onnx-pocket-tts-int8-2026-01-26; do curl -sL "$B/$u.tar.bz2" | tar xj; done
cd .. && pnpm start            # add --wav your.wav to transcribe your own 16-bit mono recording
pnpm electron-check
```

The "as read" lines are written by hand, standing in for the reader `packages/core` will get.
