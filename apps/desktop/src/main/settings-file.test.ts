import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../shared/settings.ts';
import { migrateSettings, openSettingsFile } from './settings-file.ts';

const tempDir = () => mkdtempSync(join(tmpdir(), 'interviewharness-settings-'));
const onDisk = (dir: string) => JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'));

describe('settings.json', () => {
  it('starts from defaults in a new data folder, and says it is new', async () => {
    const dir = tempDir();

    const file = openSettingsFile(dir);
    await file.flush();

    expect(file.fresh).toBe(true);
    expect(file.values()).toEqual(defaultSettings);
    expect(onDisk(dir)).toEqual({ version: 2, ...defaultSettings });
  });

  it('keeps valid changes for the next launch, and drops unknown or invalid ones', async () => {
    const dir = tempDir();
    const file = openSettingsFile(dir);

    file.change({ textSize: 'large', problemWidth: 320, theme: 'purple', apiKey: 'sk-secret', highlighting: 'yes' });
    await file.flush();
    const reopened = openSettingsFile(dir);

    expect(reopened.fresh).toBe(false);
    expect(reopened.values()).toEqual({ ...defaultSettings, textSize: 'large', problemWidth: 320 });
    expect(onDisk(dir)).not.toHaveProperty('apiKey');
  });

  it('falls back to the default for a value the file holds but no longer understands', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ version: 1, language: 'cobol', autocomplete: false }));

    expect(openSettingsFile(dir).values()).toEqual({ ...defaultSettings, autocomplete: false });
  });

  it('starts from defaults when the file is corrupt, keeping the bad file as a backup', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'settings.json'), '{"textSize": "lar');

    const file = openSettingsFile(dir);
    await file.flush();

    expect(file.values()).toEqual(defaultSettings);
    expect(onDisk(dir)).toEqual({ version: 2, ...defaultSettings });
    const backups = readdirSync(dir).filter((name) => name.startsWith('settings.json.corrupt'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dir, backups[0]!), 'utf8')).toBe('{"textSize": "lar');
  });

  it('retries while another program (an antivirus, an indexer) briefly locks the file', async () => {
    const dir = tempDir();
    const locked = (code: string) => Object.assign(new Error(code), { code });
    const failures = [locked('EPERM'), locked('EBUSY')];
    const flakyRename = async (from: string, to: string) => {
      const failure = failures.shift();
      if (failure) throw failure;
      await rename(from, to);
    };

    const file = openSettingsFile(dir, { rename: flakyRename, retryDelayMs: 1 });
    file.change({ theme: 'dark' });
    await file.flush();

    expect(failures).toHaveLength(0);
    expect(onDisk(dir)).toMatchObject({ theme: 'dark' });
    expect(readdirSync(dir)).toEqual(['settings.json']); // no temporary file left behind
  });
  it('keeps a file written by a newer version of the app, so going back to an older version loses nothing', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ version: 3, textSize: 'small', voice: 'calm' }));

    const file = openSettingsFile(dir);
    file.change({ theme: 'dark' });
    await file.flush();

    expect(file.values()).toMatchObject({ textSize: 'small', theme: 'dark' });
    expect(onDisk(dir)).toEqual({ ...defaultSettings, version: 3, textSize: 'small', theme: 'dark', voice: 'calm' });
  });

});

describe('settings migrations', () => {
  it("v0.1's picked models become your models", () => {
    const dir = tempDir();
    const interviewer = { provider: 'chatgpt', model: 'gpt-5-mini' };
    const feedback = { provider: 'ollama', model: 'qwen3:0.6b' };
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ version: 1, interviewerModel: interviewer, feedbackModel: feedback }));

    expect(openSettingsFile(dir).values()).toMatchObject({ interviewerModel: interviewer, feedbackModel: feedback, yourModels: [interviewer, feedback] });
  });

  it('a v0.1 file with nothing picked, or a model it no longer understands, starts with no models', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ version: 1, interviewerModel: { provider: 'claude-login', model: 'x' }, feedbackModel: null }));

    expect(openSettingsFile(dir).values().yourModels).toEqual([]);
  });

  it('the same model in both slots is one of your models once', () => {
    const picked = { provider: 'chatgpt', model: 'gpt-5-mini' };

    expect(migrateSettings({ version: 1, interviewerModel: picked, feedbackModel: { ...picked } })).toMatchObject({ yourModels: [picked] });
  });


  // A made-up history: version 1 called the text size `fontSize`, and version 2 renamed it.
  const migrations = { 1: ({ fontSize, ...rest }: Record<string, unknown>) => ({ ...rest, textSize: fontSize }) };

  it('brings an older file up to date, one version at a time', () => {
    expect(migrateSettings({ version: 1, fontSize: 'large', theme: 'dark' }, migrations, 2)).toEqual({
      version: 2,
      textSize: 'large',
      theme: 'dark',
    });
  });

  it('leaves a current file alone', () => {
    expect(migrateSettings({ version: 2, textSize: 'small' }, migrations, 2)).toEqual({ version: 2, textSize: 'small' });
  });
});
