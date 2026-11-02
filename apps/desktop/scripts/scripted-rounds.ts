import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLineBook, readProblem } from '@interviewharness/engine';
import { checkRound, formatPlayedRound, judgeTranscript, playCandidate, type ReplyTimes, replyTimes, type RoundFailure } from '@interviewharness/engine/scripted-candidate';
import { type Credential, type CredentialStore, createProviders, type KeyProviderName, keyProviderTable, type ModelChoice, type ProviderName, type Providers } from '@interviewharness/providers';
import { type EffortLevel, isEffortLevel, modelKey, validSettings } from '../src/shared/settings.ts';
import { scriptedCandidates } from './scripted-candidates.ts';

/**
 * Plays the scripted candidates through whole rounds of Two sum on a real model, and saves each transcript
 * to read. Run by hand, never in CI or `pnpm test`: it signs in, calls the model and takes several minutes.
 *
 *   pnpm scripted-rounds [--only silent,finishes-early] [--out <folder>] [--effort low]
 *
 * Each round's log is checked in code (no hint unasked, no phase moved but by the candidate, no failed reply);
 * the run exits non-zero when a check fails. index.md lists the failures and how long replies took.
 * After the rounds, a model reads each transcript and notes where the interviewer went wrong, into index.md: the
 * Feedback model from the app's settings, or INTERVIEWHARNESS_JUDGE (provider/model). Its notes never fail the run.
 * `--effort` sets the model's reasoning effort for the run, one of the levels it offers; else the effort set on
 * it in the app's settings, else the app's default.
 *
 * The model: INTERVIEWHARNESS_MODEL if set, as provider/model (say chatgpt/gpt-5-mini), else the interviewer's
 * model from the app's settings, built the way the app builds it (packages/providers). A model the app can't
 * run, or none picked, stops the run with a message; it is never swapped for another. The app's saved logins
 * are encrypted by Electron and can't be read from plain Node, so each provider signs in its own way here
 * (see `signIns`), with whatever it gets kept in memory only: never printed or saved.
 */

/** What to read the transcripts for. Written at the top of each run's index.md too. */
export const whatToLookFor = `What to look for in each transcript:

- Speaking when it didn't need to: anything beyond a brief acknowledgement while the candidate works,
  thinks aloud or is silent but productive.
- Hints given unasked: naming a bug, suggesting a test case, an algorithmic idea or the next step,
  when the candidate didn't ask for help. Being stuck allows one neutral question, then waiting.
- Repeated questions: asking again for testing, complexity or an explanation the candidate already gave.
- Also: help bigger than what was asked for, follow-ups as a checklist, work made up to fill the clock,
  and the notes in [brackets] (rejected attempts, timeouts, fallbacks).`;

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const signInOrigin = 'https://auth.openai.com';

/** Every file in a folder, by path relative to it with forward slashes, as readProblem takes them. */
function readFolder(dir: string) {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const path = join(dir, entry);
    if (statSync(path).isFile()) files[relative(dir, path).split(sep).join('/')] = readFileSync(path, 'utf8');
  }
  return files;
}

/** The app's data folder, where Electron keeps it for an app named InterviewHarness. */
function appDataFolder() {
  if (process.env.INTERVIEWHARNESS_DATA_DIR) return process.env.INTERVIEWHARNESS_DATA_DIR;
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'InterviewHarness');
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'InterviewHarness');
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'InterviewHarness');
}

/** A model choice the app could run, checked as the app checks settings.json, or an error saying what's wrong. */
function checkedChoice(raw: unknown, from: string): ModelChoice {
  const choice = validSettings({ interviewerModel: raw }).interviewerModel;
  if (!choice) throw new Error(`${from} names a model the app can't run: ${JSON.stringify(raw)}. Pick one in Settings → Model, or set INTERVIEWHARNESS_MODEL=provider/model.`);
  return choice;
}

/** The interviewer's model: from INTERVIEWHARNESS_MODEL, else the app's settings. Never a model nobody picked. */
function configuredModel(): ModelChoice {
  const fromEnv = process.env.INTERVIEWHARNESS_MODEL;
  if (fromEnv) {
    const slash = fromEnv.indexOf('/');
    if (slash < 0) throw new Error(`INTERVIEWHARNESS_MODEL is "${fromEnv}"; write it as provider/model, say chatgpt/${fromEnv}.`);
    const provider = fromEnv.slice(0, slash);
    // The one server this script reaches is named by INTERVIEWHARNESS_SERVER_ADDRESS, so its model needs no server id.
    return checkedChoice({ provider, model: fromEnv.slice(slash + 1), ...(provider === 'server' ? { server: 'script' } : {}) }, 'INTERVIEWHARNESS_MODEL');
  }
  const settingsPath = join(appDataFolder(), 'settings.json');
  let raw: unknown;
  try {
    const file: unknown = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
    raw = (file as { interviewerModel?: unknown }).interviewerModel;
    // The effort set on it in the app, as the app would send it.
    const picked = validSettings({ interviewerModel: raw }).interviewerModel;
    const effort = picked ? validSettings(file).yourModels?.find((yours) => modelKey(yours) === modelKey(picked))?.effort : undefined;
    if (picked && effort) raw = { ...picked, effort };
  } catch (error) {
    throw new Error(`Couldn't read ${settingsPath}: ${String(error)}. Set INTERVIEWHARNESS_MODEL=provider/model instead.`, { cause: error });
  }
  if (raw === undefined || raw === null) {
    throw new Error(`No interviewer model is picked in ${settingsPath}. Pick one in the app (Settings → Model), or set INTERVIEWHARNESS_MODEL=provider/model.`);
  }
  return checkedChoice(raw, settingsPath);
}

/** The model that judges the transcripts: INTERVIEWHARNESS_JUDGE, else the app's Feedback model, else the interviewer's. */
function judgeModel(interviewer: ModelChoice): ModelChoice {
  const fromEnv = process.env.INTERVIEWHARNESS_JUDGE;
  if (fromEnv) {
    const slash = fromEnv.indexOf('/');
    if (slash < 0) throw new Error(`INTERVIEWHARNESS_JUDGE is "${fromEnv}"; write it as provider/model.`);
    return checkedChoice({ provider: fromEnv.slice(0, slash), model: fromEnv.slice(slash + 1) }, 'INTERVIEWHARNESS_JUDGE');
  }
  const settingsPath = join(appDataFolder(), 'settings.json');
  const file: unknown = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
  const picked = validSettings(file).feedbackModel;
  if (!picked) return interviewer;
  const effort = validSettings(file).yourModels?.find((yours) => modelKey(yours) === modelKey(picked))?.effort;
  return effort ? { ...picked, effort } : picked;
}

/**
 * How this script signs in to each provider, since it can't read the app's encrypted logins. One per provider,
 * so a new provider can't run here until it says how. A provider that takes an API key should read it from an
 * environment variable and stop with a clear message when it's missing; ChatGPT has no key, only a browser login.
 */
const signIns: Record<ProviderName, (providers: Providers, choice: ModelChoice) => Promise<void>> = {
  async chatgpt(providers) {
    console.log('Sign in to ChatGPT in the browser (kept in memory for this run only).');
    await providers.loginWithChatGPT({
      deviceId: randomUUID(),
      openBrowser(url) {
        if (new URL(url).origin !== signInOrigin) throw new Error(`Refused to open ${new URL(url).origin}`);
        console.log(`If no browser opened, open this page: ${url}`);
        openInBrowser(url);
      },
    });
  },
  // Ollama needs no login. Its address is INTERVIEWHARNESS_OLLAMA_ADDRESS, else Ollama's default.
  async ollama() {},
  // Every provider in the table of key providers takes its key the same way.
  ...(Object.fromEntries(keyProviderTable.map((row) => [row.id, savedKeyFromEnvironment(row.id)])) as Record<(typeof keyProviderTable)[number]['id'], (providers: Providers) => Promise<void>>),
  // A server's key is optional; its address is INTERVIEWHARNESS_SERVER_ADDRESS, its format INTERVIEWHARNESS_SERVER_FORMAT (openai or anthropic).
  async server(providers, choice) {
    if (!serverAddress) throw new Error('Set INTERVIEWHARNESS_SERVER_ADDRESS to the server\'s address, e.g. http://localhost:1234/v1.');
    if (apiKey) await providers.saveServerKey(choice.server!, apiKey);
  },
};

/**
 * The API key for this run, kept in memory. Read before the providers are made, as they clear the provider
 * SDKs' own variables (OPENAI_API_KEY and the like), which the app never uses.
 */
const apiKey = process.env.INTERVIEWHARNESS_API_KEY;
const serverAddress = process.env.INTERVIEWHARNESS_SERVER_ADDRESS;
const serverFormat = process.env.INTERVIEWHARNESS_SERVER_FORMAT === 'anthropic' ? 'anthropic' : 'openai';

function savedKeyFromEnvironment(provider: KeyProviderName) {
  return async (providers: Providers) => {
    if (!apiKey) throw new Error(`Set INTERVIEWHARNESS_API_KEY to your ${provider} API key (kept in memory for this run only).`);
    await providers.saveKey(provider, apiKey);
  };
}

/** Logins kept in this process's memory only, gone when it exits. */
function memoryCredentials(): CredentialStore {
  const entries = new Map<string, Credential>();
  return {
    read: async (providerId) => entries.get(providerId),
    list: async () => [...entries].map(([providerId, { type }]) => ({ providerId, type })),
    async modify(providerId, fn) {
      const next = await fn(entries.get(providerId));
      if (next !== undefined) entries.set(providerId, next);
      return entries.get(providerId);
    },
    delete: async (providerId) => void entries.delete(providerId),
  };
}

/** Opens a page in the default browser on each OS, without a shell. */
function openInBrowser(url: string) {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['explorer.exe', [url]] : ['xdg-open', [url]];
  spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

export async function main(argv: string[]) {
  const { values } = parseArgs({ args: argv, options: { only: { type: 'string' }, out: { type: 'string' }, effort: { type: 'string' } } });
  const only = values.only?.split(',').map((name) => name.trim());
  const candidates = only ? scriptedCandidates.filter((c) => only.includes(c.name)) : scriptedCandidates;
  if (!candidates.length) throw new Error(`No scripted candidate named ${values.only}. There are: ${scriptedCandidates.map((c) => c.name).join(', ')}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = values.out ?? join(homedir(), 'interviewharness-scripted-rounds', stamp);
  const linesFile = readFileSync(join(repoRoot, 'content', 'interviewer', 'lines.md'), 'utf8');
  const problem = readProblem('two-sum', readFolder(join(repoRoot, 'content', 'problems', 'two-sum')));
  const configured = configuredModel();
  // Several efforts play one after another on one sign-in, each into its own folder: how the defaults are measured.
  const efforts = values.effort ? values.effort.split(',').map((level) => level.trim()) : [undefined];
  for (const effort of efforts) if (effort !== undefined && !isEffortLevel(effort)) throw new Error(`--effort ${effort} isn't a reasoning effort.`);

  const providers = createProviders({
    credentials: memoryCredentials(),
    appVersion: 'scripted-rounds',
    ...(process.env.INTERVIEWHARNESS_OLLAMA_ADDRESS ? { ollamaAddress: () => process.env.INTERVIEWHARNESS_OLLAMA_ADDRESS! } : {}),
    servers: () => (serverAddress && configured.server ? [{ id: configured.server, name: 'Server', address: serverAddress, format: serverFormat }] : []),
  });
  const levels = providers.effortLevels(configured);
  for (const effort of efforts) {
    if (effort && !levels.includes(effort as EffortLevel)) throw new Error(`${configured.model} reasons at ${levels.join(', ') || 'no levels'}, not ${effort}.`);
  }
  await signIns[configured.provider](providers, configured);
  const judgeChoice = judgeModel(configured);
  if (judgeChoice.provider !== configured.provider) await signIns[judgeChoice.provider](providers, judgeChoice);
  const judge = providers.model(judgeChoice);

  let failedChecks = 0;
  for (const effort of efforts) {
    const choice: ModelChoice = effort ? { ...configured, effort: effort as EffortLevel } : configured;
    const into = efforts.length > 1 ? join(out, effort!) : out;
    failedChecks += await playAll({ model: providers.model(choice), judge, judgeChoice, candidates, problem, linesFile, out: into, stamp });
  }
  if (efforts.length > 1) console.log(`\nEach effort's rounds are in its own folder under ${out}.`);
  return failedChecks;
}

/** Plays every candidate on one model, checks and judges each round, and writes index.md. Returns the checks that failed. */
async function playAll({ model, judge, judgeChoice, candidates, problem, linesFile, out, stamp }: {
  model: ReturnType<Providers['model']>;
  judge: ReturnType<Providers['model']>;
  judgeChoice: ModelChoice;
  candidates: typeof scriptedCandidates;
  problem: ReturnType<typeof readProblem>;
  linesFile: string;
  out: string;
  stamp: string;
}) {
  const { identity } = model;
  const named = `${identity.provider} / ${identity.model}${identity.effort ? `, effort ${identity.effort}` : ''}`;
  console.log(`Model: ${named}.`);
  mkdirSync(out, { recursive: true });
  const index = [`# Scripted rounds, ${stamp}`, '', `Model: ${named}`, '', whatToLookFor, '', '## Rounds', ''];
  const failed: { candidate: string; failure: RoundFailure }[] = [];
  const times: { candidate: string; times: ReplyTimes[] }[] = [];
  const transcripts: { candidate: (typeof candidates)[number]; transcript: string }[] = [];
  for (const candidate of candidates) {
    console.log(`Playing ${candidate.name}...`);
    const startedAt = Date.now();
    const played = await playCandidate({ candidate, model, problem, lines: createLineBook(linesFile), toneGuide: linesFile });
    // The transcript to read, and the whole round (record and log, which never hold a key or a prompt) to replay.
    writeFileSync(join(out, `${candidate.name}.md`), formatPlayedRound(played));
    writeFileSync(join(out, `${candidate.name}.json`), `${JSON.stringify(played, null, 2)}\n`);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    transcripts.push({ candidate, transcript: formatPlayedRound(played) });
    const failures = checkRound(played.log);
    failed.push(...failures.map((failure) => ({ candidate: candidate.name, failure })));
    times.push({ candidate: candidate.name, times: replyTimes(played.log) });
    index.push(`- [${candidate.name}](${candidate.name}.md): ${candidate.about} (${seconds} s to play${failures.length ? `; **${failures.length} failed**` : ''})`);
  }
  index.push('', '## Checks', '', ...(failed.length ? failed.map(({ candidate, failure }) => `- ${candidate} at ${clock(failure.at)}: ${failure.check}, ${failure.detail}`) : ['All passed.']));
  index.push('', '## Reply times', '', '| Round | Reply | Count | Median | Slowest |', '| --- | --- | --- | --- | --- |');
  for (const round of times) for (const t of round.times) index.push(`| ${round.candidate} | ${t.kind} | ${t.count} | ${seconds(t.medianMs)} | ${seconds(t.slowestMs)} |`);
  console.log(`Judging the transcripts with ${judgeChoice.provider} / ${judgeChoice.model}...`);
  index.push('', `## The judge's notes (${judgeChoice.provider} / ${judgeChoice.model}; read them, they never fail the run)`);
  for (const { candidate, transcript } of transcripts) {
    const judged = await judgeTranscript({ model: judge, transcript, about: candidate.about, whatToLookFor });
    const notes = 'failed' in judged ? [`The judge failed: ${judged.failed}.`] : judged.notes.length ? judged.notes : ['Nothing to note.'];
    index.push('', `### ${candidate.name}`, '', ...notes.map((note) => `- ${note}`));
  }
  writeFileSync(join(out, 'index.md'), `${index.join('\n')}\n`);
  console.log(`\nSaved to ${out}\n\n${whatToLookFor}`);
  console.log(failed.length ? `\n${failed.length} check${failed.length === 1 ? '' : 's'} failed; see index.md.` : '\nEvery check passed.');
  return failed.length;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** A round time as mm:ss, as the transcripts show it. */
function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
