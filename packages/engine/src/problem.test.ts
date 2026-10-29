import { describe, expect, it } from 'vitest';
import { checkProblemNames, readProblem } from './index.ts';

/** A small problem folder, as file name → text. */
function folder(overrides: Record<string, string> = {}) {
  return {
    'statement.md': '# Pair sum\n\nFind two positions that add up to `target`.\n',
    'problem.yaml': 'title: Pair sum\npattern: Hash map\ndifficulty: easy\nlicense: CC-BY-4.0\ncredits:\n  - Someone\nsource: original\n',
    'interviewer.md': [
      '# Pair sum: interviewer notes',
      '',
      '## Notes',
      '',
      'Use a hash map of seen values.',
      '',
      '## Hint ladder',
      '',
      '- Nudge: Think about what you have seen.',
      '- Question: Which value completes the pair?',
      '- Concrete: Map each value to its position.',
      '',
      '## Follow-ups',
      '',
      '- What if the list were sorted?',
      '',
    ].join('\n'),
    'reference/solution.py': 'def pair_sum(nums, target):\n    return [0, 1]\n',
    'tests.json': JSON.stringify({
      function: 'pair_sum',
      cases: [{ id: 'basic', description: 'Two values', input: { nums: [1, 2], target: 3 }, expected: [0, 1] }],
    }),
    ...overrides,
  };
}

describe('reading a problem folder', () => {
  it('reads its five parts', () => {
    const problem = readProblem('pair-sum', folder());

    expect(problem).toEqual({
      name: 'pair-sum',
      details: { title: 'Pair sum', pattern: 'Hash map', difficulty: 'easy', license: 'CC-BY-4.0', credits: ['Someone'], source: 'original' },
      statement: '# Pair sum\n\nFind two positions that add up to `target`.\n',
      notes: 'Use a hash map of seen values.',
      hintLadder: {
        nudge: 'Think about what you have seen.',
        question: 'Which value completes the pair?',
        concrete: 'Map each value to its position.',
      },
      followUps: ['What if the list were sorted?'],
      reference: { language: 'python', code: 'def pair_sum(nums, target):\n    return [0, 1]\n' },
      tests: {
        function: 'pair_sum',
        cases: [{ id: 'basic', description: 'Two values', input: { nums: [1, 2], target: 3 }, expected: [0, 1] }],
      },
    });
  });

  it('reads files saved with Windows line endings the same way', () => {
    const lf = folder();
    const crlf = Object.fromEntries(Object.entries(lf).map(([file, text]) => [file, text.replace(/\n/g, '\r\n')]));

    expect(readProblem('pair-sum', crlf)).toEqual(readProblem('pair-sum', lf));
  });

  it('says which part is missing or wrong', () => {
    const noSolution: Record<string, string> = folder();
    delete noSolution['reference/solution.py'];
    expect(() => readProblem('pair-sum', noSolution)).toThrow('pair-sum: reference/solution.py is missing');
    expect(() => readProblem('pair-sum', folder({ 'problem.yaml': 'title: Pair sum\n' }))).toThrow(
      'pair-sum: problem.yaml needs pattern',
    );
    expect(() =>
      readProblem('pair-sum', folder({ 'interviewer.md': '## Notes\n\nx\n\n## Hint ladder\n\n- Nudge: a\n' })),
    ).toThrow('pair-sum: interviewer.md needs a Question rung in its hint ladder');
    expect(() =>
      readProblem('pair-sum', folder({ 'tests.json': JSON.stringify({ function: 'f', cases: [{ id: 'a' }, { id: 'a' }] }) })),
    ).toThrow('pair-sum: tests.json');
  });
});

describe('problem names', () => {
  it('accepts names that work as folder names on every OS', () => {
    expect(checkProblemNames(['two-sum', 'merge-intervals', 'lru-cache'])).toEqual([]);
  });

  it('rejects names Windows reserves, characters it forbids, and names that differ only in case', () => {
    expect(checkProblemNames(['con', 'Aux.md', 'lpt1', 'a:b', 'what?', 'trailing.', 'Two-Sum', 'two-sum'])).toEqual([
      '"con" is a name Windows reserves',
      '"Aux.md" is a name Windows reserves',
      '"lpt1" is a name Windows reserves',
      '"a:b" has a character Windows forbids in file names',
      '"what?" has a character Windows forbids in file names',
      '"trailing." ends in a dot or space, which Windows drops',
      '"Two-Sum" and "two-sum" differ only in case, so they clash on macOS and Windows',
    ]);
  });
});
