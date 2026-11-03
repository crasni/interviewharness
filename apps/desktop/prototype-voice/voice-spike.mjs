// PROTOTYPE, throwaway (ADR 0022). Answers three questions before the v0.2.0 spec:
//   1. How long does local speech to text take on a ~10 s answer? (Moonshine v2 base, Parakeet v2)
//   2. How do Kokoro and Pocket TTS sound reading interview lines? (out/index.html, by ear)
//   3. How long until each voice has a line ready?
// Run: pnpm start            (all of it)
//      pnpm start --wav x.wav (also transcribe your own recording, 16-bit mono WAV)
// Models live in models-PROTOTYPE-wipe-me/ (see README.md for the download line).
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { cpus } from 'node:os';

const require = createRequire(import.meta.url);
const sherpa = require('sherpa-onnx-node');

const M = new URL('./models-PROTOTYPE-wipe-me/', import.meta.url).pathname;
const OUT = new URL('./out/', import.meta.url).pathname;
const THREADS = 2;
mkdirSync(OUT, { recursive: true });

// What the interviewer says, as written, and as our reader would hand it to the voice (written by hand here).
const LINES = [
  ['Okay, go on.', 'Okay, go on.'],
  ['Mm-hm. Take your time.', 'Mm-hm. Take your time.'],
  ['So that is O(n log n) because of the sort?', 'So that is O of n log n, because of the sort?'],
  ['What does seen hold after index 1?', 'What does seen hold after index one?'],
  ['Could nums[i] be negative?', 'Could nums at i be negative?'],
  ['What if n is up to 10^9?', 'What if n is up to ten to the ninth?'],
  ['Why a HashMap rather than sorting first?', 'Why a hash map rather than sorting first?'],
  ['Want to walk through BFS on the small grid?', 'Want to walk through B F S on the small grid?'],
  ['Just so you know, we have about 15 minutes left.', 'Just so you know, we have about fifteen minutes left.'],
  [
    'That makes sense. Before you code it, what happens when k is larger than the number of stores?',
    'That makes sense. Before you code it, what happens when k is larger than the number of stores?',
  ],
];

// A candidate's answer, about 10 seconds spoken, used as the speech-to-text input.
const ANSWER =
  'Okay, so I think I would use a hash map from each value to its index. I go through the array once, and for each number ' +
  'I check whether the target minus that number is already in the map. If it is, I return both indices. Otherwise I store it. ' +
  'That is linear time and linear space.';

const seconds = (ms) => (ms / 1000).toFixed(2);
const timed = (fn) => {
  const t = performance.now();
  const value = fn();
  return [value, performance.now() - t];
};
const dir = (prefix) => join(M, readdirSync(M).find((d) => d.startsWith(prefix)));

function wer(ref, hyp) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
  const r = norm(ref);
  const h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}

console.log(`sherpa-onnx ${sherpa.version}, onnxruntime ${sherpa.onnxruntimeVersion}, ${cpus()[0].model}, ${THREADS} threads\n`);

// ---------- Voices ----------
const kokoroDir = dir('kokoro-int8-multi-lang');
const kokoroLexicon = readdirSync(kokoroDir).filter((f) => f === 'lexicon-us-en.txt');
const [kokoro, kokoroLoad] = timed(
  () =>
    new sherpa.OfflineTts({
      model: {
        kokoro: {
          model: join(kokoroDir, 'model.int8.onnx'),
          voices: join(kokoroDir, 'voices.bin'),
          tokens: join(kokoroDir, 'tokens.txt'),
          lexicon: kokoroLexicon.map((f) => join(kokoroDir, f)).join(','),
        },
        numThreads: THREADS,
        provider: 'cpu',
      },
      maxNumSentences: 1,
    }),
);

const pocketDir = dir('sherpa-onnx-pocket-tts');
const [pocket, pocketLoad] = timed(
  () =>
    new sherpa.OfflineTts({
      model: {
        pocket: {
          lmFlow: join(pocketDir, 'lm_flow.int8.onnx'),
          lmMain: join(pocketDir, 'lm_main.int8.onnx'),
          encoder: join(pocketDir, 'encoder.onnx'),
          decoder: join(pocketDir, 'decoder.int8.onnx'),
          textConditioner: join(pocketDir, 'text_conditioner.onnx'),
          vocabJson: join(pocketDir, 'vocab.json'),
          tokenScoresJson: join(pocketDir, 'token_scores.json'),
          voiceEmbeddingCacheCapacity: 50,
        },
        numThreads: THREADS,
        provider: 'cpu',
      },
      maxNumSentences: 1,
    }),
);
console.log(`Load: Kokoro ${seconds(kokoroLoad)} s, Pocket TTS ${seconds(pocketLoad)} s`);

// Kokoro v1.0 speaker ids (sherpa-onnx docs): 3 af_heart, 16 am_michael, 21 bf_emma, 26 bm_george.
const voices = [
  ...[
    [3, 'af_heart'],
    [16, 'am_michael'],
    [21, 'bf_emma'],
    [26, 'bm_george'],
  ].map(([sid, name]) => ({
    engine: 'Kokoro',
    name,
    say: (text) => kokoro.generate({ text, generationConfig: new sherpa.GenerationConfig({ sid, speed: 1.0, silenceScale: 0.2 }) }),
  })),
  ...readdirSync(join(pocketDir, 'test_wavs'))
    .filter((f) => f.endsWith('.wav'))
    .map((f) => {
      const ref = sherpa.readWave(join(pocketDir, 'test_wavs', f));
      return {
        engine: 'Pocket TTS',
        name: basename(f, '.wav'),
        say: (text) =>
          pocket.generate({
            text,
            generationConfig: new sherpa.GenerationConfig({
              speed: 1.0,
              referenceAudio: ref.samples,
              referenceSampleRate: ref.sampleRate,
              numSteps: 5,
              extra: { max_reference_audio_len: 12, seed: 42 },
            }),
          }),
      };
    }),
];

const rows = LINES.map(([raw, spoken], i) => ({ i, raw, spoken, cells: [] }));
const stats = new Map();
for (const v of voices) {
  for (const row of rows) {
    for (const [kind, text] of [
      ['as written', row.raw],
      ['as read', row.spoken],
    ]) {
      if (kind === 'as read' && row.raw === row.spoken) continue;
      const [audio, ms] = timed(() => v.say(text));
      const file = `${v.engine.replace(' ', '')}-${v.name}-${row.i}-${kind === 'as read' ? 'read' : 'raw'}.wav`;
      sherpa.writeWave(join(OUT, file), { samples: audio.samples, sampleRate: audio.sampleRate });
      const dur = audio.samples.length / audio.sampleRate;
      row.cells.push({ voice: `${v.engine} · ${v.name}`, kind, file, ms, dur });
      const s = stats.get(v.engine) ?? { ms: [], rtf: [] };
      s.ms.push(ms);
      s.rtf.push(ms / 1000 / dur);
      stats.set(v.engine, s);
    }
  }
  console.log(`  ${v.engine} · ${v.name}: done`);
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const voiceSummary = [...stats].map(
  ([engine, s]) =>
    `${engine}: a line is ready in ${seconds(median(s.ms))} s median (max ${seconds(Math.max(...s.ms))} s), ` +
    `real-time factor ${median(s.rtf).toFixed(3)}`,
);
console.log('\n' + voiceSummary.join('\n'));

// ---------- Speech to text ----------
const answerAudio = kokoro.generate({
  text: ANSWER,
  generationConfig: new sherpa.GenerationConfig({ sid: 16, speed: 1.0 }),
});
sherpa.writeWave(join(OUT, 'answer.wav'), { samples: answerAudio.samples, sampleRate: answerAudio.sampleRate });
const inputs = [{ name: 'synthetic answer (Kokoro am_michael)', file: join(OUT, 'answer.wav'), ref: ANSWER }];
const wavArg = process.argv.indexOf('--wav');
if (wavArg > 0) inputs.push({ name: `your recording (${basename(process.argv[wavArg + 1])})`, file: process.argv[wavArg + 1], ref: null });

const moonDir = dir('sherpa-onnx-moonshine-base-en');
const paraDir = dir('sherpa-onnx-nemo-parakeet-tdt-0.6b-v2');
const recognizers = [
  {
    name: 'Moonshine v2 base',
    config: {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        moonshine: { encoder: join(moonDir, 'encoder_model.ort'), mergedDecoder: join(moonDir, 'decoder_model_merged.ort') },
        tokens: join(moonDir, 'tokens.txt'),
        numThreads: THREADS,
        provider: 'cpu',
      },
    },
  },
  {
    name: 'Parakeet TDT 0.6B v2',
    config: {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: join(paraDir, 'encoder.int8.onnx'),
          decoder: join(paraDir, 'decoder.int8.onnx'),
          joiner: join(paraDir, 'joiner.int8.onnx'),
        },
        tokens: join(paraDir, 'tokens.txt'),
        numThreads: THREADS,
        provider: 'cpu',
        modelType: 'nemo_transducer',
      },
    },
  },
];

const sttRows = [];
console.log('');
for (const r of recognizers) {
  const [recognizer, loadMs] = timed(() => new sherpa.OfflineRecognizer(r.config));
  for (const input of inputs) {
    const wave = sherpa.readWave(input.file);
    const dur = wave.samples.length / wave.sampleRate;
    const [text, ms] = timed(() => {
      const stream = recognizer.createStream();
      stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
      recognizer.decode(stream);
      return recognizer.getResult(stream).text;
    });
    const row = { model: r.name, input: input.name, loadMs, dur, ms, text, wer: input.ref ? wer(input.ref, text) : null };
    sttRows.push(row);
    console.log(
      `${r.name} on ${input.name}: ${dur.toFixed(1)} s of speech -> text in ${seconds(ms)} s ` +
        `(load ${seconds(loadMs)} s)${row.wer === null ? '' : `, word error ${(row.wer * 100).toFixed(1)}%`}\n  "${text.trim()}"`,
    );
  }
}

// ---------- Listening page ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const voiceNames = [...new Set(rows.flatMap((r) => r.cells.map((c) => c.voice)))];
const html = `<!doctype html><meta charset="utf-8"><title>PROTOTYPE: voices</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1c1917;background:#fafaf9}
h1{font-size:20px}h2{font-size:16px;margin-top:32px}table{border-collapse:collapse}
td,th{border-top:1px solid #e7e5e4;padding:8px 10px;vertical-align:top;text-align:left}
th{font-weight:600}audio{height:32px;width:220px;display:block}small{color:#78716c}
.line{max-width:300px}code{font-size:13px}
</style>
<h1>PROTOTYPE: Kokoro vs Pocket TTS</h1>
<p>Throwaway (ADR 0022). Each line is spoken <b>as written</b>, then <b>as read</b> (what our reader would hand the voice).
Kokoro drops words it doesn't know, so listen for gaps in "as written".</p>
<p><small>${voiceSummary.map(esc).join('<br>')}</small></p>
<table><tr><th>Line</th>${voiceNames.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>
${rows
  .map(
    (r) => `<tr><td class="line">${esc(r.raw)}${r.raw === r.spoken ? '' : `<br><small>read: ${esc(r.spoken)}</small>`}</td>${voiceNames
      .map(
        (v) =>
          `<td>${r.cells
            .filter((c) => c.voice === v)
            .map((c) => `<small>${c.kind}, ready in ${seconds(c.ms)} s</small><audio controls preload="none" src="${c.file}"></audio>`)
            .join('')}</td>`,
      )
      .join('')}</tr>`,
  )
  .join('\n')}
</table>
<h2>Speech to text</h2>
<table><tr><th>Model</th><th>Input</th><th>Speech</th><th>Text ready in</th><th>Word error</th><th>Text</th></tr>
${sttRows
  .map(
    (r) =>
      `<tr><td>${r.model}</td><td>${esc(r.input)}</td><td>${r.dur.toFixed(1)} s</td><td>${seconds(r.ms)} s</td><td>${
        r.wer === null ? '' : (r.wer * 100).toFixed(1) + '%'
      }</td><td class="line">${esc(r.text.trim())}</td></tr>`,
  )
  .join('\n')}
</table>
<p><small>The synthetic answer is clean studio-like audio, so word error here is a best case. Record yourself and run
<code>pnpm start --wav your.wav</code> for a real one.</small></p>
<audio controls src="answer.wav"></audio>`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`\nListening page: ${join(OUT, 'index.html')}`);
if (!existsSync(join(OUT, 'index.html'))) process.exit(1);
