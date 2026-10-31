import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createLineBook, readProblem } from '@interviewharness/engine';
import { formatPlayedRound, playCandidate } from '@interviewharness/engine/scripted-candidate';
import { type Credential, type CredentialStore, createProviders, defaultChatGPTModel, type ModelChoice } from '@interviewharness/providers';
import { scriptedCandidates } from './scripted-candidates.ts';

/**
 * Plays the scripted candidates through whole rounds of Two sum on a real model, and saves each transcript
 * to read. Run by hand, never in CI or `pnpm test`: it signs in, calls the model and takes several minutes.
 *
 *   pnpm scripted-rounds [--only silent,finishes-early] [--out <folder>]
 *
 * The model: INTERVIEWHARNESS_MODEL if set (a ChatGPT model id), else the interviewer's model from the app's
 * settings, else the default. The app's saved login is encrypted by Electron and can't be read from here,
 * so this signs in to ChatGPT in the browser each run and keeps the login in memory only.
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

/** The interviewer's model: from INTERVIEWHARNESS_MODEL, else the app's settings, else the default. */
function configuredModel(): ModelChoice {
  const fromEnv = process.env.INTERVIEWHARNESS_MODEL;
  if (fromEnv) return { provider: 'chatgpt', model: fromEnv };
  const settingsPath = join(appDataFolder(), 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const choice = (JSON.parse(readFileSync(settingsPath, 'utf8')) as { interviewerModel?: ModelChoice | null }).interviewerModel;
      if (choice?.provider === 'chatgpt' && typeof choice.model === 'string') return choice;
    } catch {
      // Unreadable settings: the default below.
    }
  }
  return { provider: 'chatgpt', model: defaultChatGPTModel };
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
  console.log(`Model: ${choice.provider} / ${choice.model}. Sign in to ChatGPT in the browser (kept in memory for this run only).`);
  await providers.loginWithChatGPT({
    deviceId: randomUUID(),
    openBrowser(url) {
      if (new URL(url).origin !== signInOrigin) throw new Error(`Refused to open ${new URL(url).origin}`);
      console.log(`If no browser opened, open this page: ${url}`);
      openInBrowser(url);
    },
  });
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
