import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RoundLog } from '@interviewharness/engine';

/** One events.jsonl per round, under `<dataDir>/rounds/<start time>/`. */
export function createEventsLog(dataDir: string, startedAt: Date): RoundLog {
  const dir = join(dataDir, 'rounds', startedAt.toISOString().replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'events.jsonl');
  return {
    write: (entry) => appendFileSync(file, `${JSON.stringify(entry)}\n`),
  };
}
