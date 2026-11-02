import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeKeyServer } from '@interviewharness/providers/test';
import { type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { choose, closeApp, launchApp, picker } from './launch.ts';

let app: ElectronApplication;
let window: Page;
let dataDir: string;
let server: Awaited<ReturnType<typeof fakeKeyServer>>;

test.beforeEach(async () => {
  server = await fakeKeyServer(['claude-like-1']);
});
test.afterEach(async () => {
  await closeApp(app);
  await server.close();
});

const settings = () => window.getByRole('dialog', { name: 'Settings' });
const well = (name = 'Add a connection') => settings().getByRole('group', { name });
const row = (name: string) => settings().getByRole('listitem').filter({ hasText: name });
const settingsFile = () => JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));

async function openModelTab() {
  await window.getByRole('button', { name: 'Settings' }).click();
  await settings().getByRole('tab', { name: 'Model' }).click();
}

async function addServer({ name, address, format, key }: { name: string; address: string; format: string; key?: string }) {
  await settings().getByRole('button', { name: 'Add', exact: true }).click();
  await well().getByRole('combobox', { name: 'Search' }).fill('anthropic-compatible');
  await well().getByRole('option', { name: 'Custom server' }).click();
  await well().getByLabel('Name', { exact: true }).fill(name);
  await choose(well(), 'API format', format);
  if (key) await well().getByLabel('Key, if it needs one').fill(key);
  await well().getByLabel('Address', { exact: true }).fill(address);
  await well().getByLabel('Address', { exact: true }).press('Tab');
}

test('a named Anthropic-format server is checked, saved with its key kept out of settings, and offers its model', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openModelTab();

  await addServer({ name: 'Work gateway', address: server.origin, format: 'Anthropic-compatible', key: 'gw-secret' });
  await expect(picker(well(), 'Model')).toHaveText('claude-like-1');
  server.reply({ text: 'OK' });
  await well().getByRole('button', { name: 'Check and save' }).click();

  await expect(well()).toHaveCount(0);
  await expect(row('Work gateway')).toContainText(`${server.origin} · 1 model`);
  // It spoke Anthropic's format, with the key typed in.
  const check = server.requests.find((request) => request.method === 'POST');
  expect(check?.path.split('?')[0]).toBe('/v1/messages');
  expect(check?.headers['x-api-key']).toBe('gw-secret');
  // Its model joins your models; the interviewer already had one, so that stays.
  await expect(picker(settings(), 'Interviewer model')).toHaveText(/gpt-5-mini/);
  await expect.poll(settingsFile).toMatchObject({
    servers: [{ name: 'Work gateway', address: server.origin, format: 'anthropic' }],
    yourModels: [{ provider: 'chatgpt' }, { provider: 'server', model: 'claude-like-1' }],
    interviewerModel: { provider: 'chatgpt' },
  });
  expect(readFileSync(join(dataDir, 'settings.json'), 'utf8')).not.toContain('gw-secret');
});

test('a server error names the field to fix, and nothing is saved', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openModelTab();

  server.reply({ status: 404, body: '{}' });
  await addServer({ name: 'Gateway', address: `${server.origin}/v1`, format: 'Anthropic-compatible' });
  await expect(well().getByRole('alert')).toContainText('without /v1');

  await well().getByLabel('Model id').fill('claude-like-1');
  server.reply({ status: 404, body: '{}' });
  await well().getByRole('button', { name: 'Check and save' }).click();
  await expect(well().getByRole('alert').last()).toContainText('Address:');
  expect(settingsFile().servers ?? []).toEqual([]);
});

test('a server can be edited and removed, taking its models with it', async () => {
  ({ app, window, dataDir } = await launchApp());
  await openModelTab();
  await addServer({ name: 'Home', address: `${server.origin}/v1`, format: 'OpenAI-compatible' });
  server.reply({ text: 'OK' });
  await well().getByRole('button', { name: 'Check and save' }).click();
  await expect(row('Home')).toBeVisible();

  await row('Home').getByRole('button', { name: 'Edit' }).click();
  const edit = well('Edit the server');
  await expect(edit.getByLabel('Address', { exact: true })).toHaveValue(`${server.origin}/v1`);
  // A saved server's models are looked for when Edit opens; the form grows once they're in.
  await expect(picker(edit, 'Model')).toBeVisible();
  await edit.getByLabel('Name', { exact: true }).fill('Home (Anthropic)');
  await choose(edit, 'API format', 'Anthropic-compatible');
  await edit.getByLabel('Address', { exact: true }).fill(server.origin);
  await edit.getByLabel('Address', { exact: true }).press('Tab');
  await expect(picker(edit, 'Model')).toHaveText('claude-like-1');
  server.reply({ text: 'OK' });
  await edit.getByRole('button', { name: 'Check and save' }).click();

  await expect(edit).toHaveCount(0);
  await expect(row('Home (Anthropic)')).toContainText(server.origin);
  await expect.poll(settingsFile).toMatchObject({ servers: [{ name: 'Home (Anthropic)', format: 'anthropic' }] });

  await row('Home (Anthropic)').getByRole('button', { name: 'Remove' }).click();
  await expect(row('Home (Anthropic)')).toHaveCount(0);
  await expect.poll(settingsFile).toMatchObject({ servers: [], yourModels: [{ provider: 'chatgpt' }] });
});

test("v0.1's one server becomes a server named after its host", async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'interviewharness-e2e-'));
  const address = `${server.origin}/v1`;
  writeFileSync(join(dataDir, 'settings.json'), JSON.stringify({ version: 1, serverAddress: address, interviewerModel: { provider: 'server', model: 'claude-like-1' } }));
  ({ app, window } = await launchApp({ dataDir }));
  await openModelTab();

  const host = new URL(server.origin).host;
  await expect(row(host)).toContainText(`${address} · 1 model`);
  await expect(picker(settings(), 'Interviewer model')).toHaveText(new RegExp(`claude-like-1 · ${host}`));
});
