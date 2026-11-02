// Runs scripted-rounds.ts (see there) through Vite, which reads the TypeScript the workspace packages are written in.
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { runnerImport } from 'vite';

const { module } = await runnerImport(fileURLToPath(new URL('./scripted-rounds.ts', import.meta.url)));
try {
  // A failed check fails the run, so a script or a person can tell at a glance.
  if (await module.main(process.argv.slice(2))) process.exit(1);
} catch (error) {
  // A setup problem (no model picked, one the app can't run) reads best as its message alone.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
// A sign-in or model connection may keep the process alive once every round is saved.
process.exit(0);
