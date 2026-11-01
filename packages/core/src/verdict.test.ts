import { describe, expect, it } from 'vitest';
import { type AreaScores, verdictFor } from './index.ts';

const scores = (problemSolving: number, coding: number, testing: number, communication: number) =>
  ({ problemSolving, coding, testing, communication }) as AreaScores;

describe('the verdict table', () => {
  it.each([
    [scores(4, 4, 4, 4), 'Strong hire'],
    [scores(4, 4, 4, 3), 'Strong hire'],
    [scores(4, 4, 3, 3), 'Hire'],
    [scores(3, 3, 3, 3), 'Hire'],
    [scores(4, 4, 4, 2), 'Lean hire'], // one weak area holds back a strong round
    [scores(3, 3, 2, 2), 'Lean hire'],
    [scores(3, 3, 3, 1), 'Lean no hire'], // any very weak area rules out a hire
    [scores(4, 4, 4, 1), 'Lean no hire'],
    [scores(2, 2, 2, 2), 'Lean no hire'],
    [scores(2, 2, 2, 1), 'No hire'],
    [scores(2, 2, 1, 1), 'No hire'],
    [scores(2, 1, 1, 1), 'Strong no hire'],
    [scores(1, 1, 1, 1), 'Strong no hire'],
  ])('%o gives %s', (areas, verdict) => {
    expect(verdictFor(areas)).toBe(verdict);
  });

  it('never ranks a weaker round above a stronger one', () => {
    const levels = [1, 2, 3, 4] as const;
    const rank = (areas: AreaScores) => ['Strong no hire', 'No hire', 'Lean no hire', 'Lean hire', 'Hire', 'Strong hire'].indexOf(verdictFor(areas));
    for (const a of levels)
      for (const b of levels)
        for (const c of levels)
          for (const d of levels) {
            const base = scores(a, b, c, d);
            if (a < 4) expect(rank(scores(a + 1, b, c, d))).toBeGreaterThanOrEqual(rank(base));
          }
  });
});
