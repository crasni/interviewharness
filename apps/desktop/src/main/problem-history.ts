import { closeSync, openSync, readdirSync, readSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How many rounds were done on each problem, by name, read from the rounds saved in the data folder.
 * A round's first log entry names its problem; rounds from before v0.1.2 name none, and were all Two sum.
 * A round whose log can't be read is skipped.
 */
export function roundsByProblem(dataDir: string): Map<string, number> {
  const counts = new Map<string, number>();
  let folders: string[];
  try {
    folders = readdirSync(join(dataDir, 'rounds'));
  } catch {
    return counts; // no rounds yet
  }
  for (const folder of folders) {
    const problem = problemOf(join(dataDir, 'rounds', folder, 'events.jsonl'));
    if (problem) counts.set(problem, (counts.get(problem) ?? 0) + 1);
  }
  return counts;
}

/** The problem a round's log names in its first entry, reading only the start of the log (it can be long). */
function problemOf(file: string): string | null {
  try {
    const start = Buffer.alloc(4096);
    const fd = openSync(file, 'r');
    let read: number;
    try {
      read = readSync(fd, start, 0, start.length, 0);
    } finally {
      closeSync(fd);
    }
    const text = start.toString('utf8', 0, read);
    const end = text.indexOf('\n');
    const first: unknown = JSON.parse(end === -1 ? text : text.slice(0, end));
    const started = (first as { started?: { problem?: unknown } } | null)?.started;
    return typeof started?.problem === 'string' ? started.problem : 'two-sum';
  } catch {
    return null;
  }
}
