import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RoundLog } from '@interviewharness/engine';

/** One folder per round, `<dataDir>/rounds/<start time>/`, holding its events.jsonl (and later its feedback.json). */
export function createEventsLog(dataDir: string, startedAt: Date): RoundLog & { dir: string } {
  const dir = join(dataDir, 'rounds', startedAt.toISOString().replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'events.jsonl');
  return {
    dir,
    write: (entry) => appendFileSync(file, `${JSON.stringify(entry)}\n`),
  };
}
