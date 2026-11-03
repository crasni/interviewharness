# Research: voice engines for v0.2.0

_Researched 2026-11-03 by checking npm packages, release pages and model cards. Nothing was run, so every speed figure comes from a published source. Items marked **[unverified]** could not be checked._

## Speech engine: sherpa-onnx-node
- **2.0.1** (2026-10-26), Apache-2.0. Prebuilt addons for darwin-x64/arm64, win-x64/arm64 and linux-x64/arm64; the win-arm64 package does contain the addon, though the install docs still say "Windows x64" only. https://www.npmjs.com/package/sherpa-onnx-node
- A Node-API addon, so **no electron-rebuild**. Its libraries load from beside the addon (`$ORIGIN`, `@loader_path`), so the platform package must be unpacked from asar. Its loader tries fixed relative paths; with pnpm we may have to require the `.node` file ourselves.
- **linux-x64 needs glibc 2.32** (Ubuntu 22.04+, Debian 12+); linux-arm64 needs 2.17.
- Running in an Electron utility process is the documented pattern for blocking inference, but **[unverified]** for sherpa-onnx itself.
- **2.0 removed espeak-ng (GPL)**, so the binaries are GPL-free. The cost: Kokoro's English front end is now lexicon-only and **silently drops numbers and unknown words** (https://github.com/k2-fsa/sherpa-onnx/issues/4139). The maintainer prefers an FST for numbers and won't add a G2P model; unknown words are meant to go in `lexicon.txt`. 1.13.x still bundles GPL espeak-ng.
- The npm `sherpa-onnx` WASM package is a Node build; a browser build has to be compiled ourselves (single-threaded SIMD). A fallback only.

## Speech-to-text models (all available for sherpa-onnx)
| Model | Download | Licence | Notes |
|---|---|---|---|
| Moonshine v2 base-en, quantized | 111 MB | MIT | Small and fast; about 5× less compute than Whisper tiny on 10 s |
| Moonshine v2 tiny-en, quantized | 30 MB | MIT | |
| Parakeet TDT 0.6B v2, int8 | 483 MB | CC-BY-4.0 | Most accurate English; a community ONNX test ran 20–30× faster than real time on a desktop CPU |
| Whisper base.en / small.en | 209 / 636 MB | MIT / Apache-2.0 | Tends to invent text on silence |

Sizes are the sherpa-onnx release archives (https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models). Laptop speeds through sherpa-onnx are **[unverified]**.

## Deepgram
- One recording: `POST /v1/listen` with Nova-3, **$0.0043/min**. Streaming Nova-3 and Flux: $0.0077/min. https://deepgram.com/pricing
- **Flux** (GA 2025-10-02, multilingual 2026-04-15) is streaming only (`/v2/listen`), with `EndOfTurn` (`eot_threshold` 0.5–1.0), optional eager end of turn and `TurnResumed`. https://developers.deepgram.com/docs/flux/quickstart
- `@deepgram/sdk` 5.17.0, MIT, runs in Node. Browser REST calls hit CORS, so it belongs in main or a utility process, which also keeps the key out of the renderer.

## Voice activity: @ricky0123/vad-web (for v0.2.1)
- 0.0.31, ISC. Loads its worklet, models and onnxruntime files from a CDN by default; ship them ourselves (`baseAssetPath`, `onnxWASMBasePath`). Needs `'wasm-unsafe-eval'` in the CSP and one thread with the proxy off.

## Local voices (text to speech)
| | Kokoro-82M | Pocket TTS (Kyutai) | Supertonic 3 |
|---|---|---|---|
| Licence | Apache-2.0, code and voices | Code MIT, weights CC-BY-4.0 (credit needed); use the CC0 voice-donation voices, not the non-commercial one | Weights OpenRAIL-M (use restrictions passed on); **upstream archived** |
| Input | Lexicon of phonemes: unknown words are dropped in sherpa 2.0 | Text tokens, no phonemizer: unknown words get a guess | Raw characters |
| Numbers | Dropped in sherpa 2.0 | Read natively but unreliably (a 2026-10 fix isn't in sherpa's 2026-01 model) | Claimed |
| Size (sherpa int8) | 103–147 MB | 98 MB | 129 MB |
| Speed | RTF 0.12–0.14 on an M4 Pro CPU | About 200 ms to first audio, about 6× real time on an M4 Air | About 10× faster than Kokoro |
| Character | Steady, the same every time, fixable word by word | More natural; autoregressive, so it can skip or garble a word | Fastest |

Ruled out: Kitten TTS and the kokoro-js / kitten-tts-js npm packages (their `phonemizer` is espeak-ng compiled to WASM, a GPL trap), Piper (GPL), MeloTTS (Python), NeuTTS (too heavy). OS voices through `speechSynthesis` play outside the renderer, so echo cancellation can't hear them **[inferred, unverified]**; Windows exposes only the old SAPI voices, and Linux often lists none.

misaki-rs (MIT, a Rust port of Kokoro's own G2P, no espeak) could later give Kokoro numbers and part-of-speech readings through napi-rs or WASM. Whether sherpa's Kokoro accepts phonemes directly is **[unverified]**.

**Every engine needs our own text normalizer** for interview speech: none reads "O(n^2)", "nums[i]", "1e9" or "HashMap" well, and Pocket TTS's normalizer and lexicon are open issues.

## Not verified
Real speed on our hardware; Kokoro and Pocket TTS on our sample lines; sherpa-onnx in an actual Electron utility process; vad-web in an actual Electron app; whether Pocket TTS streams through sherpa-onnx-node.
