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

## Intro
- Hi, thanks for joining. Let's start with the problem.

## Suggest approach
- Want to talk through your approach?

## Suggest code
- Want to start coding?

## Suggest test
- Want to test it?

## Suggest complexity
- Want to talk about complexity?

## Suggest wrap-up
- Shall we wrap up?

## Move on
- Sounds good.

## Wrap-up
- That's about time. Do you have any questions for me?
`);
}
