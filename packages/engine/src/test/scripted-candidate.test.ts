import { describe, expect, it } from 'vitest';
import type { Problem } from '../index.ts';
import { scriptedModel, testLines } from './fakes.ts';
import { formatPlayedRound, playCandidate, type ScriptedCandidate } from './scripted-candidate.ts';

const problem: Problem = {
  name: 'two-sum',
  details: { title: 'Two sum', pattern: 'Hash map', difficulty: 'easy', license: 'CC-BY-4.0', credits: ['Someone'], source: 'original' },
  statement: '# Two sum\n\nFind two positions whose values add up to `target`.',
  notes: 'Key idea: a map from value to position.',
  hintLadder: { nudge: 'Think about what you have seen.', question: 'Which value completes the pair?', concrete: 'Map each value to its position.' },
  followUps: ['What if the list were sorted?'],
  reference: { language: 'python', code: 'def two_sum(nums, target):\n    seen = {}\n' },
  tests: { function: 'two_sum', cases: [] },
};

/** A reply to a turn as the model gives it. */
const reply = (kind: string, words: string, heard = 'explaining') => ({
  object: { heard, movesTo: 'stays', checkedCode: false, foundOwnMistake: false, saysCodeDone: false, attemptFailed: false, hintLevel: 'none', pointsOutMistake: false, asks: 'nothing', kind, words },
});

/**
 * Lets promises settle between ticks, instead of waiting real time. setImmediate, not setTimeout(0): a
 * long silence is thousands of ticks, and Windows gives every timer a minimum delay that adds up past the test's limit.
 */
const noWait = () => new Promise<void>((resolve) => setImmediate(resolve));

function play(candidate: ScriptedCandidate, script: Parameters<typeof scriptedModel>[0]) {
  const model = scriptedModel(script);
  const played = playCandidate({ candidate, model: model.model, problem, lines: testLines(), toneGuide: '', wait: noWait });
  return { model, played };
}

describe('a scripted candidate', () => {
  it("plays a round through the interviewer: the intro, the candidate's lines and the replies, in order, and the code as left", async () => {
    const candidate: ScriptedCandidate = {
      name: 'asks-one-question',
      about: 'Asks one question, then writes code.',
      steps: [{ say: 'Can the list be empty?' }, { typeFor: 5_000, code: 'def two_sum(nums, target):\n    pass\n' }, { say: 'Okay, that is my code.' }],
    };
    const { played } = play(candidate, {
      'interviewer-reply': ['Hi, take a look at the problem.', reply('answer', 'No, it has at least two values.', 'clarifying-question'), reply('acknowledgement', 'Okay.')],
    });

    const round = await played;

    expect(round.record.transcript.map((l) => [l.who, l.text])).toEqual([
      ['interviewer', 'Hi, take a look at the problem.'],
      ['candidate', 'Can the list be empty?'],
      ['interviewer', 'No, it has at least two values.'],
      ['candidate', 'Okay, that is my code.'],
      ['interviewer', 'Okay.'],
    ]);
    expect(round.record.code).toEqual({ language: 'python', text: 'def two_sum(nums, target):\n    pass\n' });
    expect(round.model).toEqual({ provider: 'scripted', model: 'scripted-fake' });
  });

  it('sits through a long silence in round time, so the interviewer checks in', async () => {
    const candidate: ScriptedCandidate = { name: 'silent', about: 'Says nothing for three minutes.', steps: [{ silentFor: 3 * 60_000 }] };
    const { played } = play(candidate, {
      'interviewer-reply': ['Hi, take a look at the problem.', { object: { words: 'How is it going?', hintLevel: 'none' } }],
    });

    const round = await played;

    expect(round.record.transcript.map((l) => l.text)).toEqual(['Hi, take a look at the problem.', 'How is it going?']);
    expect(round.record.elapsedMs).toBeGreaterThanOrEqual(3 * 60_000);
  });

  it("doesn't hang on a model that never answers: the time limit gives the example line", async () => {
    const candidate: ScriptedCandidate = { name: 'waits', about: 'Asks a question the model never answers.', steps: [{ say: 'Can the list be empty?' }] };
    const { played } = play(candidate, { 'interviewer-reply': ['Hi, take a look at the problem.', 'wait'] });

    const round = await played;

    expect(round.record.transcript.at(-1)).toMatchObject({ who: 'interviewer', text: 'Okay, that makes sense.' });
    expect(round.events).toContainEqual(expect.objectContaining({ event: { kind: 'model-failed', error: 'timeout' } }));
  });
});

describe('a played round, written out to read', () => {
  it('names the candidate and the model, and gives each line with its time', async () => {
    const candidate: ScriptedCandidate = { name: 'asks-one-question', about: 'Asks one question.', steps: [{ silentFor: 60_000 }, { say: 'Can the list be empty?' }] };
    const { played } = play(candidate, {
      'interviewer-reply': ['Hi, take a look at the problem.', reply('answer', 'No, it has at least two values.', 'clarifying-question')],
    });

    const text = formatPlayedRound(await played);

    expect(text).toContain('# asks-one-question');
    expect(text).toContain('Asks one question.');
    expect(text).toContain('scripted / scripted-fake');
    expect(text).toMatch(/00:01 {2}Interviewer: Hi, take a look at the problem\./);
    expect(text).toMatch(/01:0\d {2}Candidate: Can the list be empty\?/);
    expect(text).toMatch(/01:0\d {2}Interviewer: No, it has at least two values\./);
  });

  it('notes what each model call heard and gave, and attempts thrown away', async () => {
    const candidate: ScriptedCandidate = { name: 'asks-for-help', about: 'Asks for help.', steps: [{ say: 'I am stuck, can you help?' }] };
    const { played } = play(candidate, {
      'interviewer-reply': ['Hi, take a look at the problem.', reply('answer', 'Think about what you have seen.', 'asking-for-help')],
      'reply-check': [{ object: { namesMistake: false, hintLevel: 'nudge', describesSolution: false } }],
    });

    const text = formatPlayedRound(await played);

    expect(text).toMatch(/heard asking-for-help, answer, hint nudge/);
  });
});
