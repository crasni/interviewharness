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

    expect(round.snapshot()).toEqual({ kind: 'coding', phase: 'clarify', elapsedMs: 0, phaseElapsedMs: 0 });
  });

  it('reports elapsed time from the injected clock', () => {
    const clock = fakeClock(1_000);
    const round = startRound('coding', clock);

    clock.advance(83_500);

    expect(round.snapshot().elapsedMs).toBe(83_500);
  });

  it('moves to the next phase when asked, and times each phase from its start', () => {
    const clock = fakeClock(1_000);
    const round = startRound('coding', clock);
    clock.advance(60_000);

    round.advancePhase();
    clock.advance(5_000);

    expect(round.snapshot()).toMatchObject({ phase: 'approach', elapsedMs: 65_000, phaseElapsedMs: 5_000 });
  });

  it('stays in wrap-up, the last phase', () => {
    const round = startRound('coding', fakeClock());
    for (let i = 0; i < 10; i++) round.advancePhase();

    expect(round.snapshot().phase).toBe('wrap-up');
  });
});
