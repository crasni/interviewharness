import { createLineBook, type FloorLogEntry } from '../index.ts';

export function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

export function fakeLog() {
  const entries: FloorLogEntry[] = [];
  return { entries, write: (entry: FloorLogEntry) => void entries.push(entry) };
}

export function testLines() {
  return createLineBook(`
## Backchannel
- Mm-hm.
- Okay.

## Acknowledgement
- Okay, that makes sense.

## Answer
- Good question. You can assume the input fits in memory.
`);
}
