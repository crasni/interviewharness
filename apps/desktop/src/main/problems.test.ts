import { describe, expect, it } from 'vitest';
import { quotesSolution } from '@interviewharness/engine';
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

  it('each have what a round needs: a statement, follow-ups and enough test cases', () => {
    for (const problem of loadProblems().values()) {
      expect(problem.statement, problem.name).toMatch(new RegExp(`^# ${problem.details.title}\n`));
      expect(problem.followUps.length, problem.name).toBeGreaterThanOrEqual(2);
      expect(problem.tests.cases.length, problem.name).toBeGreaterThanOrEqual(5);
      expect(problem.details).toMatchObject({ license: 'CC-BY-4.0', source: 'original' });
    }
  });
});

describe("the solution guard, on Two sum's real files", () => {
  const twoSum = loadProblems().get('two-sum')!;
  const leaks = (words: string) => quotesSolution(words, twoSum.reference.code);

  it('lets ordinary answers through, even ones that echo the statement', () => {
    expect(leaks('Yes, exactly one pair adds up to target.')).toBe(false);
    expect(leaks('No pair adds up to the target twice; there is exactly one.')).toBe(false);
    expect(leaks(twoSum.hintLadder.concrete)).toBe(false);
  });

  it('catches the solution read out loud, operators and all', () => {
    expect(leaks('Just check: if target minus value in seen.')).toBe(true);
    expect(leaks('for i, value in enumerate(nums): if target - value in seen: return [seen[target - value], i]')).toBe(true);
  });
});
