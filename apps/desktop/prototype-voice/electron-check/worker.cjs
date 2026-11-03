// PROTOTYPE, throwaway: runs in the utility process. Loads each engine, uses it once, reports timings.
const fs = require('node:fs');
const path = require('node:path');

const timed = (fn) => {
  const t = performance.now();
  const value = fn();
  return [value, Math.round(performance.now() - t)];
};

process.parentPort.on('message', ({ data: { models } }) => {
  const report = { ok: false, platform: process.platform, arch: process.arch, electron: process.versions.electron, steps: {} };
  try {
    const [sherpa, requireMs] = timed(() => require('sherpa-onnx-node'));
    report.sherpa = sherpa.version;
    report.steps.require = { ms: requireMs };
    const dir = (prefix) => path.join(models, fs.readdirSync(models).find((d) => d.startsWith(prefix)));

    const moon = dir('sherpa-onnx-moonshine-base-en');
    const [recognizer, sttLoadMs] = timed(
      () =>
        new sherpa.OfflineRecognizer({
          featConfig: { sampleRate: 16000, featureDim: 80 },
          modelConfig: {
            moonshine: { encoder: path.join(moon, 'encoder_model.ort'), mergedDecoder: path.join(moon, 'decoder_model_merged.ort') },
            tokens: path.join(moon, 'tokens.txt'),
            numThreads: 2,
            provider: 'cpu',
          },
        }),
    );
    // Electron's V8 memory cage forbids external ArrayBuffers, so every call that returns audio must copy it.
    const wave = sherpa.readWave(path.join(moon, 'test_wavs', fs.readdirSync(path.join(moon, 'test_wavs')).find((f) => f.endsWith('.wav'))), false);
    const [text, sttMs] = timed(() => {
      const stream = recognizer.createStream();
      stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
      recognizer.decode(stream);
      return recognizer.getResult(stream).text.trim();
    });
    report.steps.moonshine = { loadMs: sttLoadMs, ms: sttMs, speechSeconds: +(wave.samples.length / wave.sampleRate).toFixed(2), text };

    const kokoroDir = dir('kokoro-int8-multi-lang');
    const lexicon = fs.readdirSync(kokoroDir).filter((f) => f === 'lexicon-us-en.txt').map((f) => path.join(kokoroDir, f)).join(',');
    const [kokoro, kokoroLoadMs] = timed(
      () =>
        new sherpa.OfflineTts({
          model: {
            kokoro: {
              model: path.join(kokoroDir, 'model.int8.onnx'),
              voices: path.join(kokoroDir, 'voices.bin'),
              tokens: path.join(kokoroDir, 'tokens.txt'),
              lexicon,
            },
            numThreads: 2,
            provider: 'cpu',
          },
        }),
    );
    const [audio, kokoroMs] = timed(() =>
      kokoro.generate({ text: 'What does seen hold after index one?', enableExternalBuffer: false, generationConfig: new sherpa.GenerationConfig({ sid: 3 }) }),
    );
    report.steps.kokoro = { loadMs: kokoroLoadMs, ms: kokoroMs, audioSeconds: +(audio.samples.length / audio.sampleRate).toFixed(2) };

    const pocketDir = dir('sherpa-onnx-pocket-tts');
    const [pocket, pocketLoadMs] = timed(
      () =>
        new sherpa.OfflineTts({
          model: {
            pocket: {
              lmFlow: path.join(pocketDir, 'lm_flow.int8.onnx'),
              lmMain: path.join(pocketDir, 'lm_main.int8.onnx'),
              encoder: path.join(pocketDir, 'encoder.onnx'),
              decoder: path.join(pocketDir, 'decoder.int8.onnx'),
              textConditioner: path.join(pocketDir, 'text_conditioner.onnx'),
              vocabJson: path.join(pocketDir, 'vocab.json'),
              tokenScoresJson: path.join(pocketDir, 'token_scores.json'),
            },
            numThreads: 2,
            provider: 'cpu',
          },
        }),
    );
    const refFile = fs.readdirSync(path.join(pocketDir, 'test_wavs')).find((f) => f.endsWith('.wav'));
    const ref = sherpa.readWave(path.join(pocketDir, 'test_wavs', refFile), false);
    const [pocketAudio, pocketMs] = timed(() =>
      pocket.generate({
        text: 'What does seen hold after index one?',
        enableExternalBuffer: false,
        generationConfig: new sherpa.GenerationConfig({
          referenceAudio: ref.samples,
          referenceSampleRate: ref.sampleRate,
          numSteps: 5,
          extra: { max_reference_audio_len: 12, seed: 42 },
        }),
      }),
    );
    report.steps.pocket = { loadMs: pocketLoadMs, ms: pocketMs, audioSeconds: +(pocketAudio.samples.length / pocketAudio.sampleRate).toFixed(2) };
    report.ok = true;
  } catch (error) {
    report.error = String(error && error.stack ? error.stack : error);
  }
  process.parentPort.postMessage(report);
});
