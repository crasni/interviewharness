import { describe, expect, it } from 'vitest';
import { createInterviewer, floorRules as floorRulesForTest, type InterviewerEvent, type ModelCallEntry, type Problem, replyRules, roundFacts, startRound } from './index.ts';
import { fakeClock, fakeLog, type ModelScript, scriptedModel, testLines } from './test/fakes.ts';

const problem: Problem = {
  name: 'two-sum',
  details: { title: 'Two sum', pattern: 'Hash map', difficulty: 'easy', license: 'CC-BY-4.0', credits: ['Someone'], source: 'original' },
  statement: '# Two sum\n\nFind two positions whose values add up to `target`.',
  notes: 'Key idea: a map from value to position.',
  hintLadder: { nudge: 'Think about what you have seen.', question: 'Which value completes the pair?', concrete: 'Map each value to its position.' },
  followUps: ['What if the list were sorted?'],
  reference: {
    language: 'python',
    code: 'def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        if target - value in seen:\n            return [seen[target - value], i]\n        seen[value] = i\n',
  },
  tests: { function: 'two_sum', cases: [] },
};

function setup({ script = {}, withModel = true }: { script?: ModelScript; withModel?: boolean } = {}) {
  const clock = fakeClock(10_000);
  const log = fakeLog();
  const model = scriptedModel(script);
  const events: InterviewerEvent[] = [];
  const interviewer = createInterviewer({
    clock,
    round: startRound('coding', clock),
    lines: testLines(),
    log,
    model: withModel ? model.model : null,
    problem,
    toneGuide: '## Acknowledgement\n- Okay, that makes sense.',
    onEvent: (event) => events.push(event),
  });

  /** Advances time in 100 ms ticks, as the app does. */
  function wait(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      clock.advance(100);
      interviewer.onSignal({ type: 'tick' });
    }
  }

  const kinds = () => events.map((e) => e.kind);
  const spoken = () => events.flatMap((e) => ('line' in e && e.kind !== 'backchannel' ? [e.line] : []));
  const modelCalls = () =>
    log.entries.flatMap((e) => ('modelCall' in e ? [(e as ModelCallEntry).modelCall] : []));

  return { clock, log, model, events, interviewer, wait, kinds, spoken, modelCalls };
}

interface Observed {
  heard?: string;
  movesTo?: string;
  checkedCode?: boolean;
  foundOwnMistake?: boolean;
  hintLevel?: string;
  pointsOutMistake?: boolean;
  asks?: string;
}

/** A reply to a turn as the model gives it: what it observed about the turn, then the reply's kind, words, help and ask. */
const reply = (kind: string, words: string, observed: Observed = {}) => ({
  object: {
    heard: 'explaining',
    movesTo: 'stays',
    checkedCode: false,
    foundOwnMistake: false,
    hintLevel: 'none',
    pointsOutMistake: false,
    asks: 'nothing',
    ...observed,
    kind,
    words,
  },
});

/** An answer to a question (or, with `heard: 'asking-for-help'`, a hint). */
const answer = (words: string, observed: Observed = {}) => reply('answer', words, { heard: 'clarifying-question', ...observed });

/** An acknowledgement; `movesTo` is the phase the candidate's own words moved to. */
const ack = (words: string, movesTo = 'stays') => reply('acknowledgement', words, { movesTo });

/** A reply that heard the candidate as done with the phase, and offers to move on. */
const offer = (words: string) => reply('offer-next-phase', words, { heard: 'done' });

/** A help request, as the model hears it. */
const help = { heard: 'asking-for-help' };

/** The check's verdict on a reply's words (ADR 0019): by default, that they give nothing away. */
const verdict = (given: { namesMistake?: boolean; hintLevel?: string; describesSolution?: boolean } = {}) => ({
  object: { namesMistake: false, hintLevel: 'none', describesSolution: false, ...given },
});

/** Lets the model's promise settle: its words arrive between ticks, as they would from the network. */
const settle = () => new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

/** Sets up past the intro, with its words already said, and the record cleared. `checks` are the check's verdicts, in order. */
async function afterIntro(script: ModelScript['interviewer-reply'] = [], checks: ModelScript['reply-check'] = []) {
  const helpers = setup({ script: { 'interviewer-reply': ['Hi, I am Sam. Take a look at the problem.', ...script], 'reply-check': checks } });
  helpers.wait(1_000);
  await settle();
  helpers.wait(10_000);
  helpers.events.length = 0;
  helpers.log.entries.length = 0;
  helpers.model.requests.length = 0;
  return helpers;
}

describe('the interviewer', () => {
  it('opens the round in words the model wrote', async () => {
    const { wait, kinds, spoken } = setup({ script: { 'interviewer-reply': ['Hi, I am Sam. Take a look at the problem.'] } });

    wait(1_000);
    expect(kinds()).toEqual(['preparing']);
    await settle();

    expect(spoken()).toEqual(['Hi, I am Sam. Take a look at the problem.']);
  });

  it("answers a question in the model's words, holding the floor quietly while they're written", async () => {
    const { interviewer, wait, kinds, spoken, model } = await afterIntro([answer('Yes, the list can be empty.')]);

    interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
    wait(1_000);
    expect(kinds()).toEqual(['preparing']);
    await settle();

    expect(spoken()).toEqual(['Yes, the list can be empty.']);
    expect(kinds()).toEqual(['preparing', 'answer']);
    const request = model.requests[0]!;
    expect(request.purpose).toBe('interviewer-reply');
    expect(request.system).toContain('Find two positions whose values add up to `target`.');
    // The interviewer's own notes, hint ladder and the solution, to judge by (never to reveal).
    expect(request.system).toContain('Key idea: a map from value to position.');
    expect(request.system).toContain('Map each value to its position.');
    expect(request.system).toContain('def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):');
    expect(request.messages.at(-1)!.text).toContain('Can the list be empty?');
  });

  it('gives every spoken decision model-written words: acknowledgements and phase moves too', async () => {
    const { interviewer, wait, spoken } = await afterIntro([ack('Okay, go on.'), offer('Ready to talk through your approach?')], [verdict()]);

    interviewer.onSignal({ type: 'said', text: 'So the values are integers.' });
    wait(1_000);
    await settle();
    wait(5_000);
    interviewer.onSignal({ type: 'said', text: "I think that's it." });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Okay, go on.', 'Ready to talk through your approach?']);
  });

  it('carries the conversation so far into each request', async () => {
    const { interviewer, wait, model } = await afterIntro([answer('Yes.'), answer('No, exactly one pair.')]);

    interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
    wait(1_000);
    await settle();
    wait(5_000);
    interviewer.onSignal({ type: 'said', text: 'Can there be two answers?' });
    wait(1_000);

    const latest = model.requests.at(-1)!.messages.at(-1)!.text;
    expect(latest).toContain('Can values repeat?');
    expect(latest).toContain('Yes.');
    expect(latest).toContain('Can there be two answers?');
  });

  it('backchannels at once, never waiting on the model', async () => {
    const { interviewer, wait, kinds, model } = await afterIntro();

    interviewer.onSignal({ type: 'talk-start' });
    wait(3_000);
    interviewer.onSignal({ type: 'talk-end' });
    wait(1_200);

    expect(kinds()).toEqual(['backchannel']);
    expect(model.requests).toHaveLength(0);
  });

  describe('barge-in', () => {
    it('while the words are being written: aborts the request, says nothing, and drops a late reply', async () => {
      const { interviewer, wait, kinds, spoken, model, modelCalls } = await afterIntro(['wait']);
      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);

      interviewer.onSignal({ type: 'talk-start' });
      expect(model.waiting[0]!.request.signal!.aborted).toBe(true);
      model.waiting[0]!.answer(answer('Yes, it can be empty.').object); // the model answers anyway, too late
      await settle();
      wait(2_000);

      expect(kinds()).toEqual(['preparing', 'stop-preparing']);
      expect(spoken()).toEqual([]);
      expect(modelCalls().map((c) => c.outcome)).toEqual(['aborted', 'late-reply-dropped']);
    });

    it('while speaking: stops at once', async () => {
      const { interviewer, wait, kinds } = await afterIntro([answer('Yes, it can be empty, and you should handle that.')]);
      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      interviewer.onSignal({ type: 'talk-start' });

      expect(kinds()).toEqual(['preparing', 'answer', 'stop-speaking']);
    });
  });

  describe('when the model lets it down', () => {
    it('says the fallback line on an error, shows a notice, and logs the error type', async () => {
      const { interviewer, wait, events, spoken, modelCalls } = await afterIntro([{ error: 'rate-limit' }]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'rate-limit' });
      expect(spoken()).toEqual(['Okay, that makes sense.']); // not knowing what they meant, it acknowledges
      expect(modelCalls()).toMatchObject([{ outcome: 'failed', error: 'rate-limit' }]);
    });

    it('gives up on a slow reply after the time limit, says the fallback line, and drops the late words', async () => {
      const { interviewer, wait, events, spoken, model, modelCalls } = await afterIntro(['wait']);
      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(600 + replyRules.timeout - 200);
      expect(spoken()).toEqual([]);

      wait(300);
      model.waiting[0]!.answer(answer('Yes.').object);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'timeout' });
      expect(spoken()).toEqual(['Okay, that makes sense.']); // not knowing what they meant, it acknowledges
      expect(model.waiting[0]!.request.signal!.aborted).toBe(true);
      expect(modelCalls().map((c) => [c.outcome, c.error])).toEqual([
        ['failed', 'timeout'],
        ['late-reply-dropped', undefined],
      ]);
    });

    it('treats an empty reply as a failure', async () => {
      const { interviewer, wait, events, spoken } = await afterIntro([answer('   ')]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'bad-output' });
      expect(spoken()).toEqual(['Okay, that makes sense.']); // not knowing what they meant, it acknowledges
    });
  });

  it('logs each model reply with the model, its timing and outcome, and nothing secret', async () => {
    const { interviewer, wait, log, modelCalls } = await afterIntro([answer('Yes.')]);

    interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
    wait(1_000);
    await settle();

    expect(modelCalls()).toEqual([
      {
        id: 2,
        purpose: 'interviewer-reply',
        reply: 'turn',
        model: { provider: 'scripted', model: 'scripted-fake' },
        ms: 400, // asked 600 ms after the question; the words arrived when the test let them, after the ticks
        outcome: 'spoken',
        usage: { inputTokens: 0, outputTokens: 0 },
        heard: 'clarifying-question',
        turnReply: 'answer',
        hint: { askedForHelp: false, level: 'none' },
        observed: { movesTo: 'stays', checkedCode: false, foundOwnMistake: false, pointsOutMistake: false, asks: 'nothing' },
      },
    ]);
    expect(log.entries).toContainEqual(expect.objectContaining({ signal: { type: 'words', line: 'Yes.', as: 'answer' } }));
    expect(JSON.stringify(log.entries)).not.toMatch(/key|token"|secret|password/i);
  });

  it('with no model, says the example lines as written', () => {
    const { wait, spoken } = setup({ withModel: false });

    wait(1_000);

    expect(spoken()).toEqual(["Hi, thanks for joining. Let's start with the problem."]);
  });
});

describe("the candidate's code", () => {
  it('rides on what they say, is logged, and is in the next prompt', async () => {
    const { interviewer, wait, model, log } = await afterIntro([answer('Yes, that handles it.')]);
    const code = { language: 'python', text: 'def two_sum(nums, target):\n    return []\n' };

    interviewer.onSignal({ type: 'said', text: 'Does my code handle an empty list?', code });
    wait(1_000);
    await settle();

    expect(log.entries).toContainEqual(expect.objectContaining({ signal: { type: 'said', text: 'Does my code handle an empty list?', code } }));
    const prompt = model.requests.at(-1)!;
    expect(prompt.messages.at(-1)!.text).toContain('def two_sum(nums, target):\n    return []');
  });
});

describe('hints', () => {
  const askForHelp = (interviewer: { onSignal: (s: Parameters<ReturnType<typeof createInterviewer>['onSignal']>[0]) => void }, wait: (ms: number) => void) => {
    interviewer.onSignal({ type: 'said', text: "I'm stuck, can I get a hint?" });
    wait(1_000);
  };

  it('gives one rung at a time when asked, and logs the level', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      answer('Think about what you have already seen.', { ...help, hintLevel: 'nudge' }),
      answer('Which value would complete the pair?', { ...help, hintLevel: 'question' }),
    ], [verdict({ hintLevel: 'nudge' }), verdict({ hintLevel: 'question' })]);

    askForHelp(interviewer, wait);
    await settle();
    wait(5_000);
    askForHelp(interviewer, wait);
    await settle();

    expect(spoken()).toEqual(['Think about what you have already seen.', 'Which value would complete the pair?']);
    expect(modelCalls().map((c) => c.hint)).toEqual([
      { askedForHelp: true, level: 'nudge' },
      { askedForHelp: true, level: 'question' },
    ]);
  });

  it('never skips a rung: a reply that jumps ahead is written again', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      answer('Keep a map from value to position.', { ...help, hintLevel: 'concrete' }),
      answer('Think about what you have already seen.', { ...help, hintLevel: 'nudge' }),
    ], [verdict({ hintLevel: 'nudge' })]);

    askForHelp(interviewer, wait);
    await settle();

    expect(spoken()).toEqual(['Think about what you have already seen.']);
    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['hint-skipped-rung'], hint: { level: 'nudge' } }]);
  });

  it('never hints unasked: such a reply is written again, then replaced', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      answer('Yes. Also, try a hash map.', { hintLevel: 'concrete' }),
      answer('Yes, and a map would help.', { hintLevel: 'nudge' }),
    ]);

    interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Could you walk me through it with a small example?']); // a safe line that helps with nothing
    expect(modelCalls()).toMatchObject([{ outcome: 'replaced', rejected: ['hint-unasked', 'hint-unasked'] }]);
  });
});

describe('the solution guard', () => {
  const leak = 'Sure: for i, value in enumerate(nums): if target - value in seen: return [seen[target - value], i]';

  it('writes a reply again when it quotes the reference solution', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([answer(leak), answer('I can’t give you the code, but think about lookups.')]);

    interviewer.onSignal({ type: 'said', text: 'Can you just show me the code?' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['I can’t give you the code, but think about lookups.']);
    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['solution-leak'] }]);
  });

  it('replaces it with the fallback line when it quotes the solution twice', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([answer(leak), answer(leak)]);

    interviewer.onSignal({ type: 'said', text: 'Can you just show me the code?' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Could you walk me through it with a small example?']); // a safe line that helps with nothing
    expect(modelCalls()).toMatchObject([{ outcome: 'replaced', rejected: ['solution-leak', 'solution-leak'] }]);
  });

  it('lets ordinary words about the problem through', async () => {
    const { interviewer, wait, spoken } = await afterIntro([answer('Yes, values can repeat, and the target can be negative.')]);

    interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Yes, values can repeat, and the target can be negative.']);
  });
});

it('keeps replies short, cutting a long one at a sentence', async () => {
  const sentence = 'This sentence has exactly ten words in it, all told.';
  const { interviewer, wait, spoken } = await afterIntro([answer(Array(9).fill(sentence).join(' '))]);

  interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
  wait(1_000);
  await settle();

  expect(spoken()).toEqual([Array(6).fill(sentence).join(' ')]);
});

it('checks in, in words the model wrote, after a long silence', async () => {
  const { wait, spoken, modelCalls } = await afterIntro([{ object: { words: 'Want to walk me through where you are so far?', hintLevel: 'none' } }]);

  wait(floorRulesForTest.checkInAfterIdle);
  await settle();

  expect(spoken()).toEqual(['Want to walk me through where you are so far?']);
  expect(modelCalls()).toMatchObject([{ reply: 'check-in', outcome: 'spoken' }]);
});

it('keeps a record of the round for grading: lines with ids and times, phases, hints and the final code', async () => {
  const { interviewer, wait, clock } = await afterIntro([
    answer('Think about what you have already seen.', { ...help, hintLevel: 'nudge' }),
    offer('Sounds like you have it. Ready to talk through your approach?'),
  ], [verdict({ hintLevel: 'nudge' }), verdict()]);
  interviewer.onSignal({ type: 'said', text: 'Can I get a hint?' });
  wait(1_000);
  await settle();
  wait(5_000);
  interviewer.onSignal({ type: 'said', text: "I think that's it." }); // done: offers to move on
  wait(1_000);
  await settle();
  wait(5_000);
  clock.advance(60_000);
  interviewer.onSignal({ type: 'round-end', code: { language: 'python', text: 'def two_sum(nums, target): ...' } });

  const record = interviewer.record();

  expect(record.transcript.map(({ id, who }) => [id, who])).toEqual([
    ['t1', 'interviewer'],
    ['t2', 'candidate'],
    ['t3', 'interviewer'],
    ['t4', 'candidate'],
    ['t5', 'interviewer'],
  ]);
  expect(record.transcript[1]).toMatchObject({ text: 'Can I get a hint?', atMs: expect.any(Number) });
  expect(record.hints).toEqual(['nudge']);
  expect(record.code).toEqual({ language: 'python', text: 'def two_sum(nums, target): ...' });
  expect(record.elapsedMs).toBeGreaterThan(record.transcript.at(-1)!.atMs);
});

describe('the conversation sets the phase', () => {
  const phase = (helpers: { interviewer: ReturnType<typeof createInterviewer> }) => helpers.interviewer.record().phases.at(-1)!.phase;

  it('moves the round forward when the candidate has moved on by themselves', async () => {
    const helpers = await afterIntro([ack('Okay, I see you have started coding.', 'code')]);
    const { interviewer, wait, kinds } = helpers;

    interviewer.onSignal({ type: 'said', text: 'I just wrote the brute force.', code: { language: 'python', text: 'for i in range(len(nums)): ...' } });
    wait(1_000);
    await settle();

    expect(phase(helpers)).toBe('code');
    expect(kinds()).toEqual(['preparing', 'phase-moved', 'ack']);
  });

  it('moves on when the candidate asks to and the interviewer agrees', async () => {
    const helpers = await afterIntro([answer('Yes, go ahead and code it.', { heard: 'asking-to-move-on', movesTo: 'code' })]);

    helpers.interviewer.onSignal({ type: 'said', text: 'should i start coding it' });
    helpers.wait(1_000);
    await settle();

    expect(phase(helpers)).toBe('code');
  });

  it('goes back with the candidate: fixing the code after testing moves the round back to Code', async () => {
    const helpers = await afterIntro([ack('Okay.', 'test'), ack('Okay.', 'code')]);
    const { interviewer, wait, kinds } = helpers;
    interviewer.onSignal({ type: 'said', text: 'let me test it with [2, 7]' });
    wait(1_000);
    await settle();
    wait(3_000);

    interviewer.onSignal({ type: 'said', text: 'oh that is wrong, let me fix the return line' });
    wait(1_000);
    await settle();

    expect(phase(helpers)).toBe('code');
    expect(interviewer.record().phases.map((p) => p.phase)).toEqual(['clarify', 'test', 'code']);
    expect(kinds().filter((k) => k === 'phase-moved')).toHaveLength(2);
  });

  it('offers the phase after the one the candidate is really in', async () => {
    const helpers = await afterIntro([ack('Okay.', 'code'), offer('Looks right. Want to test it with an example?')], [verdict()]);
    const { interviewer, wait, events } = helpers;
    interviewer.onSignal({ type: 'said', text: 'Here is my code.' }); // jumped ahead to coding
    wait(1_000);
    await settle();
    wait(5_000);

    interviewer.onSignal({ type: 'said', text: 'done' });
    wait(1_000);
    await settle();

    expect(events.filter((e) => e.kind === 'suggest-phase')).toEqual([expect.objectContaining({ next: 'test' })]);
  });

  it('logs what each reply observed, which the round follows', async () => {
    const { interviewer, wait, modelCalls } = await afterIntro([ack('Okay.', 'approach')]);

    interviewer.onSignal({ type: 'said', text: 'I would loop over every pair.' });
    wait(1_000);
    await settle();

    expect(modelCalls()).toMatchObject([{ reply: 'turn', turnReply: 'acknowledgement', observed: { movesTo: 'approach' } }]);
  });

  it("never moves on because of the interviewer's own question", async () => {
    const helpers = await afterIntro([ack('Okay.', 'test'), reply('acknowledgement', 'Okay. What is the time complexity?', { heard: 'answering-interviewer', asks: 'complexity' })]);
    const { interviewer, wait } = helpers;
    interviewer.onSignal({ type: 'said', text: 'let me test it' });
    wait(1_000);
    await settle();
    wait(5_000);

    interviewer.onSignal({ type: 'said', text: 'for [2, 7] and 9 it returns [0, 1]' });
    wait(1_000);
    await settle();

    expect(phase(helpers)).toBe('test');
    expect(interviewer.record().asked).toEqual([{ lineId: 't5', asks: 'complexity' }]);
  });

  /** Walks the round into `to` on the candidate's word, then lets them say they're done. */
  async function doneIn(to: string, script: ReturnType<typeof reply>[]) {
    const helpers = await afterIntro([ack('Okay.', to), ...script], [verdict()]);
    helpers.interviewer.onSignal({ type: 'said', text: `on to ${to}` });
    helpers.wait(1_000);
    await settle();
    helpers.wait(5_000);
    helpers.interviewer.onSignal({ type: 'said', text: "that's it" });
    helpers.wait(1_000);
    await settle();
    return helpers;
  }

  it('turns to the follow-up questions when they finish complexity with time left', async () => {
    const helpers = await doneIn('complexity', [reply('answer', 'What if the list were sorted?', { heard: 'done', asks: 'follow-up' })]);

    expect(phase(helpers)).toBe('follow-up');
    const asked = helpers.model.requests.findLast((r) => r.purpose === 'interviewer-reply')!;
    expect(asked.system).toContain('# Follow-up questions');
    expect(asked.messages[0]!.text).toContain('ask the first follow-up question');
  });

  it('offers to wrap up instead when the follow-ups are asked or time is short', async () => {
    const helpers = await afterIntro([ack('Okay.', 'complexity'), offer('Okay. Shall we wrap up?')], [verdict()]);
    helpers.interviewer.onSignal({ type: 'said', text: 'on to complexity' });
    helpers.wait(1_000);
    await settle();
    helpers.clock.advance(41 * 60_000); // four minutes left: no time for a follow-up
    helpers.interviewer.onSignal({ type: 'said', text: "that's it" });
    helpers.wait(1_000);
    await settle();

    expect(helpers.events.filter((e) => e.kind === 'suggest-phase')).toEqual([expect.objectContaining({ next: 'wrap-up' })]);
    expect(helpers.model.requests.findLast((r) => r.purpose === 'interviewer-reply')!.messages[0]!.text).toContain('offer to move on to wrap-up');
  });

  it('says goodbye once, and is told so after', async () => {
    const helpers = await doneIn('wrap-up', [reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }), reply('stay-quiet', '', { heard: 'small-talk' })]);
    helpers.wait(5_000);
    helpers.interviewer.onSignal({ type: 'said', text: 'thanks' });
    helpers.wait(1_000);
    await settle();

    expect(helpers.spoken()).toEqual(['Okay.', 'Thanks for your time. Take care.']);
    expect(helpers.model.requests.at(-1)!.messages[0]!.text).toContain("You've said goodbye: yes.");
  });
});

describe('the round so far, kept by the app', () => {
  it('is told to the model every turn', async () => {
    const { interviewer, wait, model } = await afterIntro(
      [answer('Think about what you have already seen.', { ...help, hintLevel: 'nudge' }), ack('Okay.')],
      [verdict({ hintLevel: 'nudge' })],
    );
    interviewer.onSignal({ type: 'said', text: 'Can I get a hint?' });
    wait(1_000);
    await settle();
    wait(5_000);
    interviewer.onSignal({ type: 'said', text: 'ok' });
    wait(1_000);

    const prompt = model.requests.at(-1)!.messages[0]!.text;
    expect(prompt).toContain('# The round so far (kept by the app)');
    expect(prompt).toContain('Hints given: nudge. Next rung, if they ask: question.');
  });

  it('records who started each trace and who found each mistake', async () => {
    const { interviewer, wait, model } = await afterIntro([
      reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', asks: 'trace-example' }),
      reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer', checkedCode: true, foundOwnMistake: true }),
      reply('acknowledgement', 'Okay.', { checkedCode: true }),
    ], [verdict()]);
    for (const text of ['done coding', 'seen[5] = 0, then 5 is in seen: oh, I return the value, not i', 'and [-2, 1] with -1 gives [0, 1]']) {
      interviewer.onSignal({ type: 'said', text });
      wait(1_000);
      await settle();
      wait(5_000);
    }

    const record = interviewer.record();
    expect(record.checks).toEqual([
      { lineId: 't4', by: 'interviewer' },
      { lineId: 't6', by: 'candidate' },
    ]);
    // Found on the trace the interviewer asked for: the bug was still there when they said they were done.
    expect(record.mistakes).toEqual([{ lineId: 't4', foundBy: 'candidate-when-asked' }]);
    expect(model.requests.at(-1)!.messages[0]!.text).toContain('Times they checked their code: 0 on their own, 1 when you asked.');
  });
});

describe('a fallback line asks for what its words ask for', () => {
  /** Says each line, then waits for the reply to it. */
  async function say(helpers: { interviewer: ReturnType<typeof createInterviewer>; wait: (ms: number) => void }, texts: string[]) {
    for (const text of texts) {
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
      helpers.wait(5_000);
    }
  }

  it('credits a walkthrough asked for by the fallback to the interviewer', async () => {
    const helpers = await afterIntro([
      answer('Yes. Also, try a hash map.', { hintLevel: 'concrete' }),
      answer('Yes, and a map would help.', { hintLevel: 'nudge' }),
      reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer', checkedCode: true }),
    ]);
    await say(helpers, ['Can values repeat?', 'with [2, 7] and target 9: seen[2] = 0, then 7 finds it, so [0, 1]']);

    expect(helpers.spoken()).toEqual(['Could you walk me through it with a small example?', 'Okay.']);
    const record = helpers.interviewer.record();
    expect(record.asked).toEqual([{ lineId: 't3', asks: 'trace-example' }]);
    expect(record.checks).toEqual([{ lineId: 't4', by: 'interviewer' }]);
    expect(roundFacts(record)).toMatchObject({ tested: true, testedOnOwn: false });
  });

  it('asks for nothing when it only acknowledges, so a later trace is the candidate’s own', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', asks: 'trace-example' }),
      { error: 'rate-limit' },
      reply('acknowledgement', 'Okay.', { checkedCode: true }),
    ], [verdict()]);
    await say(helpers, ['done coding', 'actually, one more thing first', 'with [2, 7] and target 9: seen[2] = 0, then 7 finds it, so [0, 1]']);

    expect(helpers.spoken()).toEqual(['Could you trace [5, 1, 5] with target 10?', 'Okay, that makes sense.', 'Okay.']);
    const record = helpers.interviewer.record();
    expect(record.asked).toEqual([{ lineId: 't3', asks: 'trace-example' }]);
    expect(record.checks).toEqual([{ lineId: 't6', by: 'candidate' }]);
    expect(roundFacts(record).testedOnOwn).toBe(true);
  });
});

describe('what the candidate did stays in the round when the interviewer’s words fail', () => {
  // Their own check, in words the grader's backstop wouldn't catch: only the model's reading of the turn records it.
  const ownCheck = 'with [5, 1, 5] and 10, seen of 5 is 0, then 5 again: oh, I return the value, not the index';
  const observedCheck = { checkedCode: true, foundOwnMistake: true, movesTo: 'test' };

  it('keeps the check and the mistake they found when both drafts of the reply are rejected', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Right, you return the value.', { ...observedCheck, pointsOutMistake: true }),
      reply('answer', 'Yes, the value instead of its index.', { ...observedCheck, pointsOutMistake: true }),
    ]);
    const { interviewer, wait, spoken, modelCalls } = helpers;

    interviewer.onSignal({ type: 'said', text: ownCheck });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Could you walk me through it with a small example?']);
    expect(modelCalls()).toMatchObject([{ outcome: 'replaced', observed: { checkedCode: true, foundOwnMistake: true } }]);
    const record = interviewer.record();
    expect(record.checks).toEqual([{ lineId: 't2', by: 'candidate' }]);
    expect(record.mistakes).toEqual([{ lineId: 't2', foundBy: 'candidate' }]);
    expect(record.phases.at(-1)!.phase).toBe('test');
    expect(roundFacts(record)).toMatchObject({ tested: true, testedOnOwn: true, doneWithMissedBug: false });
  });

  it('applies what was observed once, however many drafts the reply takes', async () => {
    const { interviewer, wait, spoken } = await afterIntro([
      reply('answer', 'Right, you return the value.', { ...observedCheck, pointsOutMistake: true }),
      reply('acknowledgement', 'Okay.', observedCheck),
    ]);

    interviewer.onSignal({ type: 'said', text: ownCheck });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Okay.']);
    const record = interviewer.record();
    expect(record.checks).toEqual([{ lineId: 't2', by: 'candidate' }]);
    expect(record.mistakes).toEqual([{ lineId: 't2', foundBy: 'candidate' }]);
    expect(record.phases.map((p) => p.phase)).toEqual(['clarify', 'test']);
  });

  it('keeps what was observed about the turn when a barge-in drops its reply', async () => {
    const { interviewer, wait, spoken, kinds } = await afterIntro([reply('answer', 'Nice, what did you find?', { ...observedCheck, heard: 'done' })], ['wait']);

    interviewer.onSignal({ type: 'said', text: ownCheck });
    wait(1_000);
    await settle(); // the reply is written and waits on its check
    interviewer.onSignal({ type: 'talk-start' });
    await settle();

    expect(kinds()).toContain('stop-preparing');
    expect(spoken()).toEqual([]);
    const record = interviewer.record();
    expect(record.checks).toEqual([{ lineId: 't2', by: 'candidate' }]);
    expect(record.mistakes).toEqual([{ lineId: 't2', foundBy: 'candidate' }]);
  });

  it('records nothing when the model fails to read the turn, leaving their own words as the evidence', async () => {
    const { interviewer, wait, modelCalls } = await afterIntro([{ error: 'bad-output' }]);
    const traced = 'Let me trace [5, 1, 5] with target 10: I get [0, 2].';

    interviewer.onSignal({ type: 'said', text: traced });
    wait(1_000);
    await settle();

    const record = interviewer.record();
    expect(modelCalls()).toMatchObject([{ outcome: 'failed' }]);
    expect(modelCalls()[0]!.observed).toBeUndefined();
    expect(record.checks).toEqual([]);
    expect(record.mistakes).toEqual([]);
    expect(record.phases.map((p) => p.phase)).toEqual(['clarify']);
    // The failed reading isn't evidence that they didn't test: their words still count.
    expect(roundFacts(record)).toMatchObject({ tested: true, testedOnOwn: true });
  });
});

describe('a mistake is the candidate’s to find', () => {
  it('is never named unasked: such a reply is written again', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      reply('answer', 'The return value uses the number rather than its index.', { heard: 'done', pointsOutMistake: true }),
      reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', asks: 'trace-example' }),
    ], [verdict()]);

    interviewer.onSignal({ type: 'said', text: 'done coding' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Could you trace [5, 1, 5] with target 10?']);
    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['mistake-unasked'] }]);
    expect(interviewer.record().mistakes).toEqual([]);
  });

  it('may be named when they ask for help, and is recorded as the interviewer’s find', async () => {
    const { interviewer, wait, spoken } = await afterIntro([
      reply('answer', 'Look at what you return: positions or values?', { ...help, hintLevel: 'nudge', pointsOutMistake: true }),
    ], [verdict({ namesMistake: true, hintLevel: 'nudge' })]);

    interviewer.onSignal({ type: 'said', text: "it's wrong and I can't see why, help?" });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Look at what you return: positions or values?']);
    expect(interviewer.record().mistakes).toEqual([{ lineId: 't3', foundBy: 'interviewer' }]);
  });
});

describe('what the candidate meant is the model’s to understand', () => {
  it('offers to move on when the model hears them as done, however they put it', async () => {
    const { interviewer, wait, events } = await afterIntro([offer('Looks solid. Ready to talk through your approach?')], [verdict()]);

    interviewer.onSignal({ type: 'said', text: 'ok i think i got all i need' });
    wait(1_000);
    await settle();

    expect(events.filter((e) => e.kind === 'suggest-phase')).toEqual([expect.objectContaining({ next: 'approach' })]);
  });

  it('takes a reply that carries on, instead of agreeing, as "not yet" to a pending offer', async () => {
    const { interviewer, wait, events } = await afterIntro([
      offer('Ready to talk through your approach?'),
      ack('Sure, take your time.'),
    ], [verdict()]);
    interviewer.onSignal({ type: 'said', text: 'that covers my questions' });
    wait(1_000);
    await settle();
    wait(5_000);

    interviewer.onSignal({ type: 'said', text: 'wait, one more thing about duplicates' });
    wait(1_000);
    await settle();
    wait(200);

    expect(events.map((e) => e.kind)).toContain('suggestion-withdrawn');
    expect(interviewer.record().phases.map((p) => p.phase)).toEqual(['clarify']);
  });
});

describe('help when the candidate is stuck', () => {
  it('may give a small insight, unasked, when the model hears them as stuck', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      reply('answer', 'Think about what you have already seen.', { heard: 'stuck', hintLevel: 'nudge' }),
    ], [verdict({ hintLevel: 'nudge' })]);

    interviewer.onSignal({ type: 'said', text: "hmm I really don't know how to make it faster" });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Think about what you have already seen.']);
    expect(modelCalls()).toMatchObject([{ heard: 'stuck', hint: { askedForHelp: false, level: 'nudge' } }]);
  });

  it('never gives the concrete hint unasked, even when they are stuck', async () => {
    const { interviewer, wait, modelCalls } = await afterIntro([
      reply('answer', 'Keep a map from value to position.', { heard: 'stuck', hintLevel: 'concrete' }),
      reply('answer', 'What have you already seen at each step?', { heard: 'stuck', hintLevel: 'nudge' }),
    ], [verdict({ hintLevel: 'nudge' })]);

    interviewer.onSignal({ type: 'said', text: 'I am stuck' });
    wait(1_000);
    await settle();

    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['hint-too-concrete'], hint: { level: 'nudge' } }]);
  });

  it('only checks in the first time a silence runs long; a later check-in may offer a small insight', async () => {
    const { wait, spoken, modelCalls } = await afterIntro([
      { object: { words: 'Try this: what have you already seen?', hintLevel: 'nudge' } },
      { object: { words: 'Want to talk me through where you are?', hintLevel: 'none' } },
      { object: { words: 'Think about what you have already seen at each step.', hintLevel: 'nudge' } },
    ], [verdict({ hintLevel: 'nudge' })]);

    wait(floorRulesForTest.checkInAfterIdle);
    await settle();
    wait(2 * floorRulesForTest.checkInAfterIdle + 10_000);
    await settle();

    // The first check-in tried to hint: rejected, written again without one. The second may hint.
    expect(spoken()).toEqual(['Want to talk me through where you are?', 'Think about what you have already seen at each step.']);
    expect(modelCalls()).toMatchObject([
      { reply: 'check-in', rejected: ['hint-unasked'] },
      { reply: 'check-in', hint: { level: 'nudge' } },
    ]);
  });

  it('stays quiet while the candidate thinks aloud', async () => {
    const { interviewer, wait, kinds, spoken } = await afterIntro([reply('stay-quiet', '', { heard: 'thinking-aloud' })]);

    interviewer.onSignal({ type: 'said', text: 'so if I loop twice that is n squared, hmm' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual([]);
    expect(kinds()).toEqual(['preparing', 'quiet']);
  });
});

describe('the check, where help could slip (ADR 0019)', () => {
  it('catches a named mistake the reply did not admit to, and writes it again', async () => {
    const { interviewer, wait, spoken, modelCalls, model } = await afterIntro(
      [
        reply('answer', 'The return value uses the number rather than its index.', { heard: 'done' }), // claims to name nothing
        reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', asks: 'trace-example' }),
      ],
      [verdict({ namesMistake: true }), verdict()],
    );

    interviewer.onSignal({ type: 'said', text: 'done coding', code: { language: 'python', text: 'return [seen[x], nums[i]]' } });
    wait(1_000);
    await settle();
    await settle();

    expect(spoken()).toEqual(['Could you trace [5, 1, 5] with target 10?']);
    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['mistake-unasked'], check: { namesMistake: false } }]);
    const check = model.requests.find((r) => r.purpose === 'reply-check')!;
    expect(check.messages[0]!.text).toContain('The return value uses the number rather than its index.');
    expect(check.messages[0]!.text).toContain('return [seen[x], nums[i]]');
  });

  it("records the check's hint level, not the reply's own label", async () => {
    const { interviewer, wait } = await afterIntro([answer('What do you need to remember about each value?', { ...help })], [verdict({ hintLevel: 'nudge' })]);

    interviewer.onSignal({ type: 'said', text: 'can I get a hint?' });
    wait(1_000);
    await settle();

    expect(interviewer.record().hints).toEqual(['nudge']);
  });

  it('catches the solution described in words, which no code match would', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro(
      [answer('Store each value with its position as you go.', { heard: 'stuck' }), answer('What do you know at each step?', { heard: 'stuck' })],
      [verdict({ describesSolution: true }), verdict()],
    );

    interviewer.onSignal({ type: 'said', text: "I don't know how to make it faster" });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['What do you know at each step?']);
    expect(modelCalls()).toMatchObject([{ rejected: ['solution-leak'] }]);
  });

  it('rejects a later check-in that names their mistake, though it claims to give no hint', async () => {
    const { wait, spoken, modelCalls, model, interviewer } = await afterIntro(
      [
        { object: { words: 'Want to talk me through where you are?', hintLevel: 'none' } },
        { object: { words: 'Your loop returns the value instead of its index.', hintLevel: 'none' } },
        { object: { words: 'Take your time. Shout if you want to talk it through.', hintLevel: 'none' } },
      ],
      [verdict({ namesMistake: true }), verdict()],
    );

    wait(floorRulesForTest.checkInAfterIdle);
    await settle();
    wait(2 * floorRulesForTest.checkInAfterIdle + 10_000);
    await settle();
    await settle();

    expect(spoken()).toEqual(['Want to talk me through where you are?', 'Take your time. Shout if you want to talk it through.']);
    expect(model.requests.map((r) => r.purpose)).toEqual(['interviewer-reply', 'interviewer-reply', 'reply-check', 'interviewer-reply', 'reply-check']);
    expect(modelCalls()).toMatchObject([
      { reply: 'check-in', outcome: 'spoken' },
      { reply: 'check-in', outcome: 'spoken', rejected: ['mistake-unasked'], hint: { level: 'none' } },
    ]);
    const record = interviewer.record();
    expect(record.hints).toEqual([]);
    expect(record.mistakes).toEqual([]);
  });

  it('is not waited on for plain answers', async () => {
    const { interviewer, wait, model } = await afterIntro([answer('Yes, values can repeat.')]);

    interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
    wait(1_000);
    await settle();

    expect(model.requests.map((r) => r.purpose)).toEqual(['interviewer-reply']);
  });

  it('gets its own time limit, apart from the reply it checks', async () => {
    const { interviewer, wait, spoken, model } = await afterIntro([reply('answer', 'Could you trace [5, 1, 5]?', { heard: 'done' })], ['wait']);

    interviewer.onSignal({ type: 'said', text: 'done coding' });
    wait(1_000);
    await settle();
    wait(replyRules.timeout - 500); // the check has waited nearly the limit; the whole reply has waited longer
    expect(spoken()).toEqual([]);

    model.waiting[0]!.answer(verdict().object);
    await settle();

    expect(spoken()).toEqual(['Could you trace [5, 1, 5]?']);
  });
});
