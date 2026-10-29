import { describe, expect, it } from 'vitest';
import { loadProblems } from './problems.ts';

describe('the problems in content/problems', () => {
  it('all load, with names that work on every OS', () => {
    const problems = loadProblems();

    expect(problems.get('two-sum')).toMatchObject({
      details: { title: 'Two sum', license: 'CC-BY-4.0' },
      hintLadder: { nudge: expect.any(String), question: expect.any(String), concrete: expect.any(String) },
      reference: { language: 'python' },
    });
    expect(problems.get('two-sum')!.statement).toMatch(/^# Two sum\n/);
  });
});
