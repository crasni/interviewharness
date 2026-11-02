// Runs scripted-rounds.ts (see there) inside Electron, so it can use the app's saved logins and keys, which only
// Electron's safeStorage can decrypt. No window opens. Vite's runner reads the workspace's TypeScript.
import console from 'node:console';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { app, safeStorage } from 'electron';
import { runnerImport } from 'vite';

// The app's name and data folder, so safeStorage uses the app's key and the store is the app's own file.
app.setName('InterviewHarness');
const dataDir = process.env.INTERVIEWHARNESS_DATA_DIR ?? join(app.getPath('appData'), 'InterviewHarness');
app.setPath('userData', dataDir);
app.dock?.hide();

// Electron fires ready only once this module has run, so nothing here waits at the top level.
app.whenReady().then(async () => {
  let code = 0;
  try {
    const here = (file) => fileURLToPath(new URL(file, import.meta.url));
    const { module: store } = await runnerImport(here('../src/main/credential-store.ts'));
    const { module: rounds } = await runnerImport(here('./scripted-rounds.ts'));
    const credentials = store.openCredentialStore(dataDir, {
      backend: () => (process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'os'),
      encrypt: (text) => safeStorage.encryptStringAsync(text),
      decrypt: (data) => safeStorage.decryptStringAsync(data),
    });
    // Electron's own arguments come first: the script's start after this file.
    const argv = process.argv.slice(process.argv.findIndex((arg) => arg.endsWith('scripted-rounds-app.mjs')) + 1);
    // A failed check fails the run, so a script or a person can tell at a glance.
    if (await rounds.main(argv, { credentials, installId: credentials.installId })) code = 1;
  } catch (error) {
    // A setup problem (no model picked, one the app can't run) reads best as its message alone.
    console.error(error instanceof Error ? error.message : error);
    code = 1;
  }
  // A sign-in or model connection may keep the process alive once every round is saved.
  app.exit(code);
});
