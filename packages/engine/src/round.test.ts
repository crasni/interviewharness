import { describe, expect, it } from 'vitest';
import { startRound } from './index.ts';

function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('a coding round', () => {
  it('starts in the Clarify phase with no time elapsed', () => {
    const round = startRound('coding', fakeClock(1_000));

    expect(round.snapshot()).toEqual({ kind: 'coding', phase: 'clarify', elapsedMs: 0 });
  });

  it('reports elapsed time from the injected clock', () => {
    const clock = fakeClock(1_000);
    const round = startRound('coding', clock);

    clock.advance(83_500);

    expect(round.snapshot().elapsedMs).toBe(83_500);
  });
});
