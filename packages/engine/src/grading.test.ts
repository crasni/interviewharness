import { describe, expect, it } from 'vitest';
import { gradeRound, type Problem, type RoundRecord, roundFacts } from './index.ts';
import { scriptedModel } from './test/fakes.ts';

const problem: Problem = {
  name: 'two-sum',
  details: { title: 'Two sum', pattern: 'Hash map', difficulty: 'easy', license: 'CC-BY-4.0', credits: ['Someone'], source: 'original' },
  statement: '# Two sum\n\nFind two positions whose values add up to `target`.',
  notes: 'Key idea: a map from value to position.',
  hintLadder: { nudge: 'Think about what you have seen.', question: 'Which value completes the pair?', concrete: 'Map each value to its position.' },
  followUps: [],
  reference: { language: 'python', code: 'def two_sum(nums, target):\n    seen = {}\n' },
  tests: { function: 'two_sum', cases: [] },
};

/** A round that reached Test, with no hints: four lines of conversation. */
function record(overrides: Partial<RoundRecord> = {}): RoundRecord {
  return {
    elapsedMs: 30 * 60_000,
    transcript: [
      { id: 't1', who: 'interviewer', text: 'Hi, take a look at the problem.', atMs: 5_000 },
      { id: 't2', who: 'candidate', text: 'Can values repeat?', atMs: 65_000 },
      { id: 't3', who: 'candidate', text: 'I would keep a map of seen values.', atMs: 300_000 },
      { id: 't4', who: 'candidate', text: 'Let me trace [5, 1, 5] with target 10.', atMs: 1_500_000 },
    ],
    phases: [
      { phase: 'clarify', atMs: 0 },
      { phase: 'approach', atMs: 120_000 },
      { phase: 'code', atMs: 400_000 },
      { phase: 'test', atMs: 1_400_000 },
    ],
    hints: [],
    checks: [],
    mistakes: [],
    asked: [],
    code: { language: 'python', text: 'def two_sum(nums, target):\n    ...' },
    ...overrides,
  };
}

/** One grader's scores, each area with the transcript lines it cites. */
const sample = (scores: [number, number, number, number], evidence: string[][] = [['t2'], ['t3'], ['t4'], ['t2']]) => ({
  object: {
    problemSolving: { score: scores[0], evidence: evidence[0] },
    coding: { score: scores[1], evidence: evidence[1] },
    testing: { score: scores[2], evidence: evidence[2] },
    communication: { score: scores[3], evidence: evidence[3] },
  },
});

const prose = {
  object: {
    why: 'Clear questions and a sound plan, tested by hand.',
    wentWell: [{ text: 'Asked whether values repeat.', evidence: 't2' }],
    toFix: [
      { text: 'Traced only one example.', evidence: 't4' },
      { text: 'Something the round never had.', evidence: 't99' },
    ],
  },
};

describe('grading a round', () => {
  it('takes the median of three samples per area, and turns it into the verdict by the fixed table', async () => {
    const model = scriptedModel({ grading: [sample([4, 3, 3, 4]), sample([3, 3, 2, 4]), sample([4, 4, 3, 3])], 'feedback-prose': [prose] });

    const feedback = await gradeRound({ model: model.model, problem, record: record(), rough: false });

    expect(feedback.areas).toMatchObject({
      problemSolving: { score: 4 },
      coding: { score: 3 },
      testing: { score: 3 },
      communication: { score: 4 },
    });
    expect(feedback.verdict).toBe('Hire'); // 4 + 3 + 3 + 4 = 14, nothing below 3
    expect(model.requests.filter((r) => r.purpose === 'grading')).toHaveLength(3);
  });

  it('drops evidence that points at no line of the round, and lowers a score left with none', async () => {
    const unknown = [['t2'], ['t42'], ['t4', 't77'], ['t2']];
    const model = scriptedModel({ grading: [sample([4, 4, 4, 4], unknown), sample([4, 4, 4, 4], unknown), sample([4, 4, 4, 4], unknown)], 'feedback-prose': [prose] });

    const feedback = await gradeRound({ model: model.model, problem, record: record(), rough: false });

    expect(feedback.areas.coding).toEqual({ score: 3, evidence: [] });
    expect(feedback.areas.testing).toEqual({ score: 4, evidence: ['t4'] });
    // Kept for replay: each sample as the grader gave it, and as it was checked.
    expect(feedback.samples).toHaveLength(3);
    expect(feedback.samples[0]).toMatchObject({
      given: { coding: { score: 4, evidence: ['t42'] } },
      checked: { coding: { score: 3, evidence: [] } },
    });
  });

  it('caps problem solving by the deepest hint asked for, more for each rung', async () => {
    const grade = async (hints: RoundRecord['hints']) => {
      const model = scriptedModel({ grading: [sample([4, 4, 4, 4]), sample([4, 4, 4, 4]), sample([4, 4, 4, 4])], 'feedback-prose': [prose] });
      return (await gradeRound({ model: model.model, problem, record: record({ hints }), rough: false })).areas.problemSolving.score;
    };

    expect(await grade([])).toBe(4);
    expect(await grade(['nudge'])).toBe(3);
    expect(await grade(['nudge', 'question'])).toBe(2);
    expect(await grade(['nudge', 'question', 'concrete'])).toBe(1);
  });

  it('caps testing at mixed when the candidate never checked their code, and nothing was found wrong with it', async () => {
    const model = scriptedModel({ grading: [sample([4, 4, 4, 4]), sample([4, 4, 4, 4]), sample([4, 4, 4, 4])], 'feedback-prose': [prose] });
    // Never reached Test, and never checked the code (t4 is left out); nothing was found wrong with it.
    const untested = record({
      phases: [{ phase: 'clarify', atMs: 0 }, { phase: 'approach', atMs: 120_000 }, { phase: 'code', atMs: 400_000 }],
      transcript: record().transcript.slice(0, 3),
    });

    const feedback = await gradeRound({ model: model.model, problem, record: untested, rough: false });

    expect(feedback.areas.testing.score).toBe(2);
  });

  const allStrong = () => scriptedModel({ grading: [sample([4, 4, 4, 4]), sample([4, 4, 4, 4]), sample([4, 4, 4, 4])], 'feedback-prose': [prose] });

  it('caps testing at mixed when the only checks were ones the interviewer asked for, and tells the grader who started each', async () => {
    const model = allStrong();
    const askedOnly = record({ checks: [{ lineId: 't4', by: 'interviewer' }], asked: [{ lineId: 't1', asks: 'trace-example' }] });

    const feedback = await gradeRound({ model: model.model, problem, record: askedOnly, rough: false });

    expect(feedback.areas.testing.score).toBe(2);
    const graded = model.requests.find((r) => r.purpose === 'grading')!.messages.at(-1)!.text;
    expect(graded).toContain('Checked their code: yes. On their own: no.');
    expect(graded).toContain('Times they checked their code: when the interviewer asked t4.');
  });

  it('caps testing at weak when they said done with a bug they never caught themselves', async () => {
    const model = allStrong();
    const missedBug = record({ checks: [{ lineId: 't4', by: 'interviewer' }], mistakes: [{ lineId: 't4', foundBy: 'candidate-when-asked' }] });

    const feedback = await gradeRound({ model: model.model, problem, record: missedBug, rough: false });

    expect(feedback.areas.testing.score).toBe(1);
    const graded = model.requests.find((r) => r.purpose === 'grading')!.messages.at(-1)!.text;
    expect(graded).toContain('Mistakes found in their code or approach: by the candidate, on a check the interviewer asked for t4.');
  });

  it('leaves testing to the grader when they checked on their own, even if they missed something', async () => {
    const ownCheck = record({ checks: [{ lineId: 't4', by: 'candidate' }], mistakes: [{ lineId: 't3', foundBy: 'interviewer' }] });

    const feedback = await gradeRound({ model: allStrong().model, problem, record: ownCheck, rough: false });

    expect(feedback.areas.testing.score).toBe(4);
  });

  it('writes why, what went well and what to fix, each point at the time of its evidence', async () => {
    const model = scriptedModel({ grading: [sample([4, 3, 3, 4]), sample([4, 3, 3, 4]), sample([4, 3, 3, 4])], 'feedback-prose': [prose] });

    const feedback = await gradeRound({ model: model.model, problem, record: record(), rough: true });

    expect(feedback).toMatchObject({
      why: 'Clear questions and a sound plan, tested by hand.',
      wentWell: [{ text: 'Asked whether values repeat.', atMs: 65_000 }],
      toFix: [{ text: 'Traced only one example.', atMs: 1_500_000 }], // the point with no real evidence is gone
      rough: true,
      model: { provider: 'scripted', model: 'scripted-fake' },
    });
    // The writer sees the round's lines and the scores, to explain them in words.
    const asked = model.requests.find((r) => r.purpose === 'feedback-prose')!.messages.at(-1)!.text;
    expect(asked).toContain('Can values repeat?');
  });

  it('fails as a whole when the model fails, so it can be tried again', async () => {
    const model = scriptedModel({ grading: [{ error: 'offline' }, sample([4, 4, 4, 4]), sample([4, 4, 4, 4])] });

    await expect(gradeRound({ model: model.model, problem, record: record(), rough: false })).rejects.toMatchObject({ kind: 'offline' });
  });
});

describe('the facts of a round', () => {
  it('are worked out in code: phases reached and time in each, hints, whether it was tested', () => {
    expect(roundFacts(record({ hints: ['nudge'] }))).toEqual({
      phasesReached: ['clarify', 'approach', 'code', 'test'],
      timeInPhaseMs: { clarify: 120_000, approach: 280_000, code: 1_000_000, test: 400_000 },
      hints: ['nudge'],
      deepestHint: 'nudge',
      tested: true,
      testedOnOwn: true,
      doneWithMissedBug: false,
    });
  });
});

it('counts checking the code against values as testing, and reaching Test without it as not', () => {
  const traced = record({ phases: [{ phase: 'clarify', atMs: 0 }, { phase: 'code', atMs: 400_000 }] }); // t4 checks [5, 1, 5]
  const untraced = record({ phases: traced.phases, transcript: traced.transcript.slice(0, 3) });

  expect(roundFacts(traced).tested).toBe(true);
  expect(roundFacts(untraced).tested).toBe(false);
  // Reaching Test is only a phase: with no example walked through, nothing was tested.
  expect(roundFacts(record({ transcript: traced.transcript.slice(0, 3) })).tested).toBe(false);
});
