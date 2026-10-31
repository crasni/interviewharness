// Runs scripted-rounds.ts (see there) through Vite, which reads the TypeScript the workspace packages are written in.
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { runnerImport } from 'vite';

const { module } = await runnerImport(fileURLToPath(new URL('./scripted-rounds.ts', import.meta.url)));
await module.main(process.argv.slice(2));
// A sign-in or model connection may keep the process alive once every round is saved.
process.exit(0);
