import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLineBook, readProblem } from '@interviewharness/engine';
import { formatPlayedRound, playCandidate } from '@interviewharness/engine/scripted-candidate';
import { type Credential, type CredentialStore, createProviders, type ModelChoice, type ProviderName, type Providers } from '@interviewharness/providers';
import { validSettings } from '../src/shared/settings.ts';
import { scriptedCandidates } from './scripted-candidates.ts';

/**
 * Plays the scripted candidates through whole rounds of Two sum on a real model, and saves each transcript
 * to read. Run by hand, never in CI or `pnpm test`: it signs in, calls the model and takes several minutes.
 *
 *   pnpm scripted-rounds [--only silent,finishes-early] [--out <folder>]
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
    return checkedChoice({ provider: fromEnv.slice(0, slash), model: fromEnv.slice(slash + 1) }, 'INTERVIEWHARNESS_MODEL');
  }
  const settingsPath = join(appDataFolder(), 'settings.json');
  let raw: unknown;
  try {
    raw = existsSync(settingsPath) ? (JSON.parse(readFileSync(settingsPath, 'utf8')) as { interviewerModel?: unknown }).interviewerModel : undefined;
  } catch (error) {
    throw new Error(`Couldn't read ${settingsPath}: ${String(error)}. Set INTERVIEWHARNESS_MODEL=provider/model instead.`, { cause: error });
  }
  if (raw === undefined || raw === null) {
    throw new Error(`No interviewer model is picked in ${settingsPath}. Pick one in the app (Settings → Model), or set INTERVIEWHARNESS_MODEL=provider/model.`);
  }
  return checkedChoice(raw, settingsPath);
}

/**
 * How this script signs in to each provider, since it can't read the app's encrypted logins. One per provider,
 * so a new provider can't run here until it says how. A provider that takes an API key should read it from an
 * environment variable and stop with a clear message when it's missing; ChatGPT has no key, only a browser login.
 */
const signIns: Record<ProviderName, (providers: Providers) => Promise<void>> = {
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
};

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
  const { values } = parseArgs({ args: argv, options: { only: { type: 'string' }, out: { type: 'string' } } });
  const only = values.only?.split(',').map((name) => name.trim());
  const candidates = only ? scriptedCandidates.filter((c) => only.includes(c.name)) : scriptedCandidates;
  if (!candidates.length) throw new Error(`No scripted candidate named ${values.only}. There are: ${scriptedCandidates.map((c) => c.name).join(', ')}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = values.out ?? join(homedir(), 'interviewharness-scripted-rounds', stamp);
  const linesFile = readFileSync(join(repoRoot, 'content', 'interviewer', 'lines.md'), 'utf8');
  const problem = readProblem('two-sum', readFolder(join(repoRoot, 'content', 'problems', 'two-sum')));
  const choice = configuredModel();

  const providers = createProviders({ credentials: memoryCredentials(), appVersion: 'scripted-rounds' });
  console.log(`Model: ${choice.provider} / ${choice.model}.`);
  await signIns[choice.provider](providers);
  const model = providers.model(choice);

  mkdirSync(out, { recursive: true });
  const index = [`# Scripted rounds, ${stamp}`, '', `Model: ${choice.provider} / ${choice.model}`, '', whatToLookFor, '', '## Rounds', ''];
  for (const candidate of candidates) {
    console.log(`Playing ${candidate.name}...`);
    const startedAt = Date.now();
    const played = await playCandidate({ candidate, model, problem, lines: createLineBook(linesFile), toneGuide: linesFile });
    // The transcript to read, and the whole round (record and log, which never hold a key or a prompt) to replay.
    writeFileSync(join(out, `${candidate.name}.md`), formatPlayedRound(played));
    writeFileSync(join(out, `${candidate.name}.json`), `${JSON.stringify(played, null, 2)}\n`);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    index.push(`- [${candidate.name}](${candidate.name}.md): ${candidate.about} (${seconds} s to play)`);
  }
  writeFileSync(join(out, 'index.md'), `${index.join('\n')}\n`);
  console.log(`\nSaved to ${out}\n\n${whatToLookFor}`);
}
