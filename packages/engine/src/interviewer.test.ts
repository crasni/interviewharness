import { describe, expect, it } from 'vitest';
import { createInterviewer, floorRules as floorRulesForTest, gradeRound, type InterviewerEvent, type ModelCallEntry, type Problem, replyRules, roundFacts, startRound } from './index.ts';
import { fakeClock, fakeLog, type ModelScript, scriptedModel, testLines } from './test/fakes.ts';

const problem: Problem = {
  name: 'two-sum',
  details: { title: 'Two sum', pattern: 'Hash map', difficulty: 'easy', license: 'CC-BY-4.0', credits: ['Someone'], source: 'original' },
  statement: '# Two sum\n\nFind two positions whose values add up to `target`.',
  notes: 'Key idea: a map from value to position.',
  hintLadder: { nudge: 'Think about what you have seen.', question: 'Which value completes the pair?', concrete: 'Map each value to its position.' },
  followUps: ['What if the list were sorted?', 'What if there could be several valid pairs?'],
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
  saysCodeDone?: boolean;
  attemptFailed?: boolean;
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
    saysCodeDone: false,
    attemptFailed: false,
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

/** Asking once, in Wrap-up, whether they have questions: what must come before any goodbye. */
const askQuestions = reply('answer', 'Any questions for me?', { heard: 'done', asks: 'their-questions' });

/** A check-in as the model writes it: its words, and the hint rung it says they give. */
const checkIn = (words: string, hintLevel = 'none') => ({ object: { words, hintLevel } });

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

  it("falls back to the intro's example line when the model fails, and says the intro is what failed", async () => {
    const { wait, events, spoken } = setup({ script: { 'interviewer-reply': [{ error: 'offline' }] } });

    wait(1_000);
    await settle();

    expect(events).toContainEqual({ kind: 'model-failed', error: 'offline', reply: 'intro' });
    expect(spoken()).toHaveLength(1);
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
    it('says nothing on an error, shows a notice, and logs the error type', async () => {
      const { interviewer, wait, events, spoken, modelCalls } = await afterIntro([{ error: 'rate-limit' }]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'rate-limit', reply: 'turn' });
      expect(spoken()).toEqual([]); // a stock "okay" would pretend it heard them
      expect(modelCalls()).toMatchObject([{ outcome: 'failed', error: 'rate-limit' }]);
    });

    it("logs why a reply failed, in the error's own words, cut short", async () => {
      const message = `Server error 502: ${'upstream unavailable '.repeat(20)}`;
      const { interviewer, wait, modelCalls } = await afterIntro([{ error: 'other', message }]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      const [failed] = modelCalls();
      expect(failed).toMatchObject({ outcome: 'failed', error: 'other' });
      expect(failed!.reason).toMatch(/^Server error 502: upstream unavailable/);
      expect(failed!.reason!.length).toBeLessThanOrEqual(200);
    });

    it('logs a bug of ours as other, with its name and message as the reason', async () => {
      const { interviewer, wait, modelCalls } = await afterIntro([{ thrown: new TypeError("Cannot read properties of undefined (reading 'kind')") }]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      expect(modelCalls()).toMatchObject([{ outcome: 'failed', error: 'other', reason: "TypeError: Cannot read properties of undefined (reading 'kind')" }]);
    });

    it('gives up on a slow reply after the time limit, says nothing, and drops the late words', async () => {
      const { interviewer, wait, events, spoken, model, modelCalls } = await afterIntro(['wait']);
      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(600 + replyRules.timeout - 200);
      expect(spoken()).toEqual([]);

      wait(300);
      model.waiting[0]!.answer(answer('Yes.').object);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'timeout', reply: 'turn' });
      expect(spoken()).toEqual([]); // a stock "okay" would pretend it heard them
      expect(model.waiting[0]!.request.signal!.aborted).toBe(true);
      expect(modelCalls().map((c) => [c.outcome, c.error])).toEqual([
        ['failed', 'timeout'],
        ['late-reply-dropped', undefined],
      ]);
    });

    it('waits for a slow model: a reply after 30 seconds is still said', async () => {
      const { interviewer, wait, events, spoken, model, modelCalls } = await afterIntro(['wait']);
      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(600 + 30_000);
      model.waiting[0]!.answer(answer('Yes, it can be empty.').object);
      await settle();
      wait(1_000);

      expect(spoken()).toEqual(['Yes, it can be empty.']);
      expect(events).not.toContainEqual(expect.objectContaining({ kind: 'model-failed' }));
      expect(modelCalls().map((c) => c.outcome)).toEqual(['spoken']);
    });

    it('treats an empty reply as a failure', async () => {
      const { interviewer, wait, events, spoken } = await afterIntro([answer('   ')]);

      interviewer.onSignal({ type: 'said', text: 'Can the list be empty?' });
      wait(1_000);
      await settle();

      expect(events).toContainEqual({ kind: 'model-failed', error: 'bad-output', reply: 'turn' });
      expect(spoken()).toEqual([]); // a stock "okay" would pretend it heard them
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
        observed: { movesTo: 'stays', checkedCode: false, foundOwnMistake: false, saysCodeDone: false, attemptFailed: false, pointsOutMistake: false, asks: 'nothing' },
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

it('checks in after a long silence in words the model wrote', async () => {
  const { wait, spoken, model } = await afterIntro([checkIn('Want to talk me through where you are?')]);

  wait(floorRulesForTest.checkInAfterIdle);
  await settle();

  expect(spoken()).toEqual(['Want to talk me through where you are?']);
  expect(model.requests.map((r) => r.purpose)).toEqual(['interviewer-reply']);
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
    const helpers = await doneIn('wrap-up', [askQuestions, reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }), reply('stay-quiet', '', { heard: 'small-talk' })]);
    for (const text of ['no, all good', 'thanks']) {
      helpers.wait(5_000);
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
    }

    expect(helpers.spoken()).toEqual(['Okay.', 'Any questions for me?', 'Thanks for your time. Take care.']);
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

  it('says nothing when a reply fails, so its ask stays open and a later trace answers it', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', asks: 'trace-example' }),
      { error: 'rate-limit' },
      reply('acknowledgement', 'Okay.', { checkedCode: true }),
    ], [verdict()]);
    await say(helpers, ['done coding', 'actually, one more thing first', 'with [2, 7] and target 9: seen[2] = 0, then 7 finds it, so [0, 1]']);

    expect(helpers.spoken()).toEqual(['Could you trace [5, 1, 5] with target 10?', 'Okay.']);
    const record = helpers.interviewer.record();
    expect(record.asked).toEqual([{ lineId: 't3', asks: 'trace-example' }]);
    expect(record.checks).toEqual([{ lineId: 't5', by: 'interviewer' }]);
    expect(roundFacts(record).testedOnOwn).toBe(false);
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

describe('a missed bug counts only after the candidate said their code was done', () => {
  /** A grader that scores every area strong, so only the caps in code lower it. */
  const strongGrader = () => {
    const strong = { score: 4, evidence: ['t2'] };
    const sample = { object: { problemSolving: strong, coding: strong, testing: strong, communication: strong } };
    return scriptedModel({ grading: [sample, sample, sample], 'feedback-prose': [{ object: { why: 'Fine.', wentWell: [], toFix: [] } }] });
  };

  async function turns(script: ModelScript['interviewer-reply'], checks: ModelScript['reply-check'], said: string[]) {
    const helpers = await afterIntro(script, checks);
    for (const text of said) {
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
      helpers.wait(5_000);
    }
    return helpers.interviewer.record();
  }

  it('does not treat debugging help asked for while still coding as handing in buggy work', async () => {
    const record = await turns(
      [
        reply('answer', 'Look at what you return: positions or values?', { ...help, hintLevel: 'nudge', pointsOutMistake: true }),
        reply('acknowledgement', 'Okay.', { heard: 'done', saysCodeDone: true }),
      ],
      [verdict({ namesMistake: true, hintLevel: 'nudge' })],
      ["it's wrong and I can't see why, help?", 'oh, fixed it. done'],
    );

    expect(record.mistakes).toEqual([{ lineId: 't3', foundBy: 'interviewer' }]);
    expect(record.codeDone).toEqual(['t4']);
    expect(roundFacts(record).doneWithMissedBug).toBe(false);
    const feedback = await gradeRound({ model: strongGrader().model, problem, record, rough: false });
    // Never checked on their own, so mixed at best; not weak, as no finished code had a bug in it.
    expect(feedback.areas.testing.score).toBe(2);
  });

  it('does not count finishing an explanation as saying the code is done', async () => {
    const record = await turns(
      [
        reply('acknowledgement', 'Okay.', { heard: 'done', saysCodeDone: false }),
        reply('answer', 'Look at what you return: positions or values?', { ...help, hintLevel: 'nudge', pointsOutMistake: true }),
      ],
      [verdict({ namesMistake: true, hintLevel: 'nudge' })],
      ["that's my approach, done explaining", "it's wrong and I can't see why, help?"],
    );

    expect(record.codeDone).toEqual([]);
    expect(roundFacts(record).doneWithMissedBug).toBe(false);
  });

  it('still caps testing at weak when they said done and the bug came out only on the interviewer’s check', async () => {
    const record = await turns(
      [
        reply('answer', 'Could you trace [5, 1, 5] with target 10?', { heard: 'done', saysCodeDone: true, asks: 'trace-example' }),
        reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer', checkedCode: true, foundOwnMistake: true }),
      ],
      [verdict()],
      ['done coding', 'seen[5] = 0, then 5 is in seen: oh, I return the value, not i'],
    );

    expect(record.codeDone).toEqual(['t2']);
    expect(roundFacts(record).doneWithMissedBug).toBe(true);
    const feedback = await gradeRound({ model: strongGrader().model, problem, record, rough: false });
    expect(feedback.areas.testing.score).toBe(1);
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

describe('help only when asked', () => {
  /** The candidate says something, and the interviewer's reply is written and said. */
  async function turn(helpers: Awaited<ReturnType<typeof afterIntro>>, text: string) {
    helpers.interviewer.onSignal({ type: 'said', text });
    helpers.wait(1_000);
    await settle();
    await settle();
    helpers.wait(5_000);
  }

  it('gives a long silence only neutral check-ins, never a hint, however long it lasts', async () => {
    const { wait, spoken, modelCalls, interviewer } = await afterIntro(
      [
        checkIn('How is it going?'),
        checkIn('Think about the values you have already seen.', 'nudge'),
        checkIn('Maybe think about what you have seen so far?'),
        checkIn('Still with me? Talk it through whenever you like.'),
      ],
      [verdict({ hintLevel: 'nudge' }), verdict()],
    );

    // Three check-ins: after 2.5, 5 and 10 more minutes, each settled before the next is due.
    for (const after of [1, 2, 4]) {
      wait(after * floorRulesForTest.checkInAfterIdle);
      await settle();
      await settle();
      wait(10_000);
    }

    // The second one's two drafts both gave a hint, so it fell back to a reviewed check-in line.
    expect(spoken()).toEqual(['How is it going?', 'Take your time. Talk it through whenever you like.', 'Still with me? Talk it through whenever you like.']);
    expect(modelCalls()).toMatchObject([
      { reply: 'check-in', outcome: 'spoken' },
      { reply: 'check-in', outcome: 'replaced', rejected: ['hint-unasked', 'hint-unasked'] },
      { reply: 'check-in', outcome: 'spoken' },
    ]);
    expect(interviewer.record().hints).toEqual([]);
  });

  it('answers "I\'m stuck" with one neutral question and no hint, then gives them space', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Think about what you have already seen.', { heard: 'stuck', hintLevel: 'nudge' }),
      reply('answer', 'What feels blocked?', { heard: 'stuck', asks: 'what-blocks' }),
      checkIn('Take your time. Talk it through whenever you like.'),
    ], [verdict()]);

    await turn(helpers, "I'm stuck");
    helpers.wait(floorRulesForTest.checkInAfterIdle);
    await settle();

    expect(helpers.spoken()).toEqual(['What feels blocked?', 'Take your time. Talk it through whenever you like.']);
    expect(helpers.modelCalls()).toMatchObject([
      { heard: 'stuck', rejected: ['hint-unasked'], hint: { askedForHelp: false, level: 'none' } },
      { reply: 'check-in', outcome: 'spoken' },
    ]);
    expect(helpers.interviewer.record().hints).toEqual([]);
  });

  it('never tells a stuck candidate what to try next', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Try tracing [5, 1, 5] by hand.', { heard: 'stuck', asks: 'trace-example' }),
      reply('answer', 'What feels blocked?', { heard: 'stuck', asks: 'what-blocks' }),
    ], [verdict()]);

    await turn(helpers, "I don't know how to go on");

    expect(helpers.spoken()).toEqual(['What feels blocked?']);
    expect(helpers.modelCalls()).toMatchObject([{ rejected: ['step-unasked'] }]);
  });

  it('asks what feels blocked at most once while they stay stuck: a second asking is written again', async () => {
    const helpers = await afterIntro([
      reply('answer', 'What feels blocked?', { heard: 'stuck', asks: 'what-blocks' }),
      reply('answer', 'What part feels blocked?', { heard: 'stuck', asks: 'what-blocks' }),
      reply('answer', 'Want a hint?', { heard: 'stuck', asks: 'offer-help' }),
    ], [verdict(), verdict()]);

    await turn(helpers, "I'm stuck");
    await turn(helpers, 'still stuck, no idea');

    expect(helpers.spoken()).toEqual(['What feels blocked?', 'Want a hint?']);
    expect(helpers.modelCalls()).toMatchObject([{ outcome: 'spoken' }, { outcome: 'spoken', rejected: ['what-blocks-repeated'] }]);
  });

    it('offers help only after repeated failed attempts, when they have not said they are stuck', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Want a hint?', { attemptFailed: true, asks: 'offer-help' }),
      reply('acknowledgement', 'Okay.', { attemptFailed: true }),
      reply('answer', 'Would a hint help?', { attemptFailed: true, asks: 'offer-help' }),
    ]);

    await turn(helpers, 'ran [2, 7] with 9 and got an empty list');
    await turn(helpers, 'fixed the loop, still an empty list');

    expect(helpers.spoken()).toEqual(['Okay.', 'Would a hint help?']);
    expect(helpers.modelCalls()).toMatchObject([{ rejected: ['offer-unasked'] }, { outcome: 'spoken', observed: { asks: 'offer-help' } }]);
  });

  it('gives the next rung when they accept the offer, recorded as help they asked for', async () => {
    const helpers = await afterIntro([
      reply('answer', 'Want a hint?', { heard: 'stuck', asks: 'offer-help' }),
      reply('answer', 'Think about what you have already seen.', { heard: 'agreeing', hintLevel: 'nudge' }),
    ], [verdict(), verdict({ hintLevel: 'nudge' })]);

    await turn(helpers, "I'm stuck, I've tried everything I can think of");
    await turn(helpers, 'yes please');

    expect(helpers.spoken()).toEqual(['Want a hint?', 'Think about what you have already seen.']);
    expect(helpers.modelCalls().at(-1)).toMatchObject({ hint: { askedForHelp: true, level: 'nudge' }, check: { hintLevel: 'nudge' } });
    expect(helpers.interviewer.record().hints).toEqual(['nudge']);
  });

  it('stops offering help and checking in once they decline, until they get back to work', async () => {
    const helpers = await afterIntro([
      reply('acknowledgement', 'Okay.', { attemptFailed: true }),
      reply('answer', 'Want a hint?', { attemptFailed: true, asks: 'offer-help' }),
      reply('acknowledgement', 'Sure.', { heard: 'declining' }),
      reply('answer', 'Want a hint now?', { attemptFailed: true, asks: 'offer-help' }),
      reply('acknowledgement', 'Okay.', { attemptFailed: true }),
      checkIn('Take your time. Talk it through whenever you like.'),
    ]);

    await turn(helpers, 'got an empty list for [2, 7]');
    await turn(helpers, 'still empty');
    await turn(helpers, "no thanks, I'd rather find it myself");
    await turn(helpers, 'still empty, hmm');
    helpers.wait(3 * floorRulesForTest.checkInAfterIdle);
    await settle();

    expect(helpers.spoken()).toEqual(['Okay.', 'Want a hint?', 'Sure.', 'Okay.']);
    expect(helpers.modelCalls().at(-1)).toMatchObject({ rejected: ['offer-unasked'] });

    helpers.interviewer.onSignal({ type: 'editor-activity' });
    helpers.wait(floorRulesForTest.checkInAfterIdle);
    await settle();

    expect(helpers.spoken().at(-1)).toBe('Take your time. Talk it through whenever you like.');
  });

  it('never checks in while the candidate is working', async () => {
    const { interviewer, wait, kinds } = await afterIntro();

    for (let i = 0; i < 120; i++) {
      interviewer.onSignal({ type: 'editor-activity' });
      wait(5_000);
    }

    expect(kinds()).toEqual([]);
  });

  it('gives a candidate who works through approach, code and testing on their own no instructions', async () => {
    const helpers = await afterIntro([
      reply('acknowledgement', 'Okay.', { movesTo: 'approach' }),
      reply('acknowledgement', 'Sounds good.', { movesTo: 'code' }),
      reply('acknowledgement', 'Okay.', { movesTo: 'test', checkedCode: true }),
    ]);

    await turn(helpers, 'no more questions. Pairs would be n squared, a map from value to index makes it one pass');
    await turn(helpers, "I'll code that up");
    await turn(helpers, 'written. [2, 7, 11] with 9 gives [0, 1], and [3, 3] with 6 gives [0, 1]');

    const record = helpers.interviewer.record();
    expect(record.phases.map((p) => p.phase)).toEqual(['clarify', 'approach', 'code', 'test']);
    expect(record.asked).toEqual([]);
    expect(record.hints).toEqual([]);
    expect(record.checks).toEqual([{ lineId: 't6', by: 'candidate' }]);
    // Nothing tells the model to ask for what they haven't covered yet.
    expect(helpers.model.requests.map((r) => r.messages[0]!.text).join('\n')).not.toMatch(/cover it first/);
  });

  it('answers a syntax question with only the syntax, never the algorithm', async () => {
    const helpers = await afterIntro([
      answer('A dict: d = {}. Map each value to its position as you go.', { hintLevel: 'concrete' }),
      answer('In Python, a dict: d = {}.'),
    ]);

    await turn(helpers, 'how do I make a hash map in python?');

    expect(helpers.spoken()).toEqual(['In Python, a dict: d = {}.']);
    expect(helpers.modelCalls()).toMatchObject([{ rejected: ['hint-unasked'] }]);
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
        checkIn('Want to talk me through where you are?'),
        checkIn('Your loop returns the value instead of its index.'),
        checkIn('Take your time. Shout if you want to talk it through.'),
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

describe('time and closing', () => {
  const minute = 60_000;
  type Helpers = Awaited<ReturnType<typeof afterIntro>>;
  const roundElapsed = (helpers: Helpers) => helpers.interviewer.record().elapsedMs;
  /** Waits, in ticks, until the round has run this long. */
  const waitUntil = (helpers: Helpers, elapsedMs: number) => helpers.wait(elapsedMs - roundElapsed(helpers));
  const timeEvents = (helpers: Helpers) => helpers.events.filter((e) => e.kind === 'time-reminder' || e.kind === 'closing');

  /** Walks the round into Wrap-up on the candidate's word, then lets them say they're done. */
  async function doneEarly(script: ReturnType<typeof reply>[]) {
    const helpers = await afterIntro([ack('Okay.', 'wrap-up'), ...script], [verdict()]);
    helpers.interviewer.onSignal({ type: 'said', text: "I'm finished, let's wrap up" });
    helpers.wait(1_000);
    await settle();
    helpers.wait(5_000);
    helpers.interviewer.onSignal({ type: 'said', text: "that's it" });
    helpers.wait(1_000);
    await settle();
    return helpers;
  }

  it('reminds of the time twice, as a reviewed line: with 15 minutes left and with 5', async () => {
    const helpers = await afterIntro();

    waitUntil(helpers, 44 * minute);

    expect(timeEvents(helpers)).toEqual([
      { kind: 'time-reminder', minutesLeft: 15, line: 'Just so you know, we have about 15 minutes left.', speakingMs: expect.any(Number) },
      { kind: 'time-reminder', minutesLeft: 5, line: 'Just so you know, we have about 5 minutes left.', speakingMs: expect.any(Number) },
    ]);
    expect(helpers.modelCalls().filter((c) => c.reply !== 'check-in')).toEqual([]);
  });

  it('never interrupts the candidate mid-work: it waits for a pause, then gives only the time actually left', async () => {
    const helpers = await afterIntro();
    waitUntil(helpers, 29 * minute);

    // Typing straight through both marks, then talking for a while.
    while (roundElapsed(helpers) < 41 * minute) {
      helpers.interviewer.onSignal({ type: 'editor-activity' });
      helpers.wait(1_000);
    }
    helpers.interviewer.onSignal({ type: 'talk-start' });
    helpers.wait(20_000);
    expect(timeEvents(helpers)).toEqual([]);

    helpers.interviewer.onSignal({ type: 'talk-end' });
    helpers.wait(10_000);

    expect(timeEvents(helpers)).toEqual([expect.objectContaining({ kind: 'time-reminder', minutesLeft: 4 })]);
  });

  it('closes at time with one reviewed line that turns to Wrap-up, but never ends the round by itself', async () => {
    const helpers = await afterIntro([answer('Sure, take a minute to finish.')]);

    // Typing now and then, with pauses long enough for the time but too short for a check-in.
    while (roundElapsed(helpers) < 50 * minute) {
      helpers.interviewer.onSignal({ type: 'editor-activity' });
      helpers.wait(minute);
    }

    expect(timeEvents(helpers).map((e) => e.kind)).toEqual(['time-reminder', 'time-reminder', 'closing']);
    expect(timeEvents(helpers).at(-1)).toMatchObject({ line: "That's about time. Do you have any questions for me?" });
    expect(helpers.interviewer.record().phases.at(-1)!.phase).toBe('wrap-up');
    expect(helpers.model.requests).toEqual([]);

    // The round goes on until the candidate ends it.
    helpers.interviewer.onSignal({ type: 'said', text: 'can I just finish this line?' });
    helpers.wait(1_000);
    await settle();
    expect(helpers.spoken().at(-1)).toBe('Sure, take a minute to finish.');
  });

  it('lets End round win over the clock: nothing is said after it', async () => {
    const helpers = await afterIntro();
    waitUntil(helpers, 44 * minute);
    helpers.events.length = 0;

    helpers.interviewer.onSignal({ type: 'round-end' });
    helpers.wait(10 * minute);

    expect(helpers.events).toEqual([]);
  });

  it('gives no reminder or closing once the candidate finished early and the round is in Wrap-up', async () => {
    const helpers = await doneEarly([reply('answer', 'Do you have any questions for me?', { heard: 'done' })]);

    waitUntil(helpers, 50 * minute);

    expect(helpers.interviewer.record().phases.at(-1)!.phase).toBe('wrap-up');
    expect(timeEvents(helpers)).toEqual([]);
  });

  /** Says one line after another, each answered before the next. */
  async function say(helpers: Helpers, said: string[]) {
    for (const text of said) {
      helpers.wait(5_000);
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
    }
  }

  it('asks once for their questions before saying goodbye: a goodbye before that is written again', async () => {
    const helpers = await doneEarly([
      reply('goodbye', 'Thanks for your time. That wraps up the interview.', { heard: 'agreeing' }),
      reply('answer', 'Before we finish, do you have any questions for me?', { heard: 'agreeing', asks: 'their-questions' }),
      reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }),
    ]);
    await say(helpers, ["no, I'm good"]);

    expect(helpers.spoken()).toEqual(['Okay.', 'Before we finish, do you have any questions for me?', 'Thanks for your time. Take care.']);
    expect(helpers.modelCalls().slice(1).map((c) => c.rejected)).toEqual([['goodbye-too-soon'], undefined]);
    const rewrite = helpers.model.requests.filter((r) => r.purpose === 'interviewer-reply')[2]!.messages[0]!.text;
    expect(rewrite).toContain('Before any goodbye, ask once whether they have questions for you');
    expect(rewrite).toContain('it said goodbye before asking whether they have questions for you');
  });

  it('says the reviewed line asking for their questions when every reply says goodbye too soon', async () => {
    const helpers = await doneEarly([
      reply('goodbye', 'Thanks for your time.', { heard: 'agreeing' }),
      reply('goodbye', 'Great work, take care.', { heard: 'agreeing' }),
      reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }),
    ]);
    await say(helpers, ["no, I'm good"]);

    expect(helpers.spoken()).toEqual(['Okay.', 'Do you have any questions for me?', 'Thanks for your time. Take care.']);
    expect(helpers.modelCalls().slice(1).map((c) => c.outcome)).toEqual(['replaced', 'spoken']);
  });

  it('counts the closing line at time as asking for their questions', async () => {
    const helpers = await afterIntro([reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' })]);
    // Typing now and then, so the silence gets no check-in, until the closing line at time.
    while (roundElapsed(helpers) < 46 * minute) {
      helpers.interviewer.onSignal({ type: 'editor-activity' });
      helpers.wait(minute);
    }
    expect(timeEvents(helpers).at(-1)).toMatchObject({ kind: 'closing' });
    await say(helpers, ['no questions, thanks']);

    expect(helpers.spoken().at(-1)).toBe('Thanks for your time. Take care.');
    expect(helpers.modelCalls().at(-1)!.rejected).toBeUndefined();
  });

  it('stays quiet after the goodbye: thanks does not reopen the round, and neither does the clock', async () => {
    const helpers = await doneEarly([
      askQuestions,
      reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }),
      reply('acknowledgement', "You're welcome! Anything else you'd like to go over?", { heard: 'small-talk' }),
    ]);
    await say(helpers, ['no, all good', 'thanks!']);
    waitUntil(helpers, 50 * minute);

    expect(helpers.spoken()).toEqual(['Okay.', 'Any questions for me?', 'Thanks for your time. Take care.']);
    // The log says the words were held back, not spoken.
    expect(helpers.modelCalls().at(-1)).toMatchObject({ outcome: 'quiet-after-goodbye', heard: 'small-talk', turnReply: 'acknowledgement' });
  });

  it('answers a real question after the goodbye, about the problem or to the interviewer, but never says goodbye twice', async () => {
    const helpers = await doneEarly([
      askQuestions,
      reply('goodbye', 'Thanks for your time. Take care.', { heard: 'declining' }),
      reply('answer', "It's a practice round, so there's no real team, but ask me anything about the problem.", { heard: 'small-talk' }),
      reply('answer', 'Yes, values can repeat.', { heard: 'clarifying-question' }),
      reply('goodbye', 'Bye now, take care!', { heard: 'small-talk' }),
    ]);
    await say(helpers, ['no, all good', "what's the team like?", 'oh, could the values repeat?', 'bye!']);

    expect(helpers.spoken()).toEqual([
      'Okay.',
      'Any questions for me?',
      'Thanks for your time. Take care.',
      "It's a practice round, so there's no real team, but ask me anything about the problem.",
      'Yes, values can repeat.',
    ]);
    expect(helpers.modelCalls().at(-1)).toMatchObject({ outcome: 'quiet-after-goodbye', turnReply: 'goodbye' });
  });
});

describe('a wrong answer gets one probe', () => {
  /** A grader that scores every area strong, so only the caps in code lower it. */
  const strongGrader = () => {
    const strong = { score: 4, evidence: ['t2'] };
    const sample = { object: { problemSolving: strong, coding: strong, testing: strong, communication: strong } };
    return scriptedModel({ grading: [sample, sample, sample], 'feedback-prose': [{ object: { why: 'Fine.', wentWell: [], toFix: [] } }] });
  };

  async function turns(script: ModelScript['interviewer-reply'], checks: ModelScript['reply-check'], said: string[]) {
    const helpers = await afterIntro(script, checks);
    for (const text of said) {
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
      helpers.wait(5_000);
    }
    return helpers;
  }

  /** A probe: one short neutral question that makes them check a handed-over answer themselves. */
  const probe = (words: string, observed: Observed = {}) => reply('answer', words, { heard: 'answering-interviewer', asks: 'probe', ...observed });

  it('asks one neutral question about a wrong follow-up answer, then moves on to the next follow-up whatever they say', async () => {
    const helpers = await turns(
      [
        ack('Okay.', 'complexity'),
        reply('answer', 'What if the list were sorted?', { heard: 'done', asks: 'follow-up' }),
        probe('Which positions does that give back: the sorted ones or the original ones?'),
        reply('answer', 'What if there could be several valid pairs?', { heard: 'answering-interviewer', asks: 'follow-up' }),
      ],
      [verdict(), verdict()],
      ['on to complexity', 'O(n) time and space, done', 'sort it in place, then two pointers, return l and r', 'the sorted ones, I think that is fine'],
    );

    expect(helpers.spoken()).toEqual([
      'Okay.',
      'What if the list were sorted?',
      'Which positions does that give back: the sorted ones or the original ones?',
      'What if there could be several valid pairs?',
    ]);
    // The probe is checked like any reply where help could slip in.
    expect(helpers.model.requests.filter((r) => r.purpose === 'reply-check')).toHaveLength(2);
    expect(helpers.interviewer.record().asked).toEqual([
      { lineId: 't5', asks: 'follow-up' },
      { lineId: 't7', asks: 'probe' },
      { lineId: 't9', asks: 'follow-up' },
    ]);
    const prompts = helpers.model.requests.filter((r) => r.purpose === 'interviewer-reply');
    expect(prompts.at(-1)!.messages[0]!.text).toContain('# Mistakes, probes and staying quiet');
    expect(prompts.at(-1)!.messages[0]!.text).toContain('Your last line was a probe: their reply to it gets no probe.');
  });

  it('may probe a new, different answer given in the same turn as the reply to a probe', async () => {
    const helpers = await turns(
      [
        probe('Okay. What does your trace give for the second number?'),
        probe('How much can the dictionary hold as the input grows?'),
      ],
      [verdict(), verdict()],
      ['i=1: seen[1] = 0, so it returns [0, 2]', "oh, seen[1] = 1, I wrote 0 by mistake. and it's O(n) time and O(1) space"],
    );

    expect(helpers.spoken()).toEqual(['Okay. What does your trace give for the second number?', 'How much can the dictionary hold as the input grows?']);
    expect(helpers.modelCalls()).toMatchObject([{ outcome: 'spoken' }, { outcome: 'spoken' }]);
    expect(helpers.modelCalls()[1]!.rejected).toBeUndefined();
  });

  it('describes what a probe does without example probes from a problem, so its words are its own', async () => {
    const helpers = await turns([probe('Okay. What does your trace give for the second number?')], [verdict()], ['i=1: seen[1] = 0, so it returns [0, 2]']);

    const [written, checked] = ['interviewer-reply', 'reply-check'].map((purpose) => helpers.model.requests.find((r) => r.purpose === purpose)!);
    for (const request of [written!, checked!]) {
      const prompt = request.system + request.messages[0]!.text;
      expect(prompt).not.toContain('What does seen hold');
      expect(prompt).not.toContain('Where does the data live');
    }
    expect(written!.messages[0]!.text).toContain('in your own words');
  });

  it('never probes more than twice in a row: a third probe is written again', async () => {
    const helpers = await turns(
      [
        probe('Okay. What does your trace give for the second number?'),
        probe('How much can the dictionary hold as the input grows?'),
        probe('And what does that make the space?'),
        reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer' }),
      ],
      [verdict(), verdict()],
      ['it returns [0, 2]', "seen[1] = 1, my slip. and it's O(1) space", 'it holds one entry per number'],
    );

    expect(helpers.spoken().at(-1)).toBe('Okay.');
    expect(helpers.modelCalls().at(-1)).toMatchObject({ outcome: 'spoken', rejected: ['probe-repeated'] });
    // The model is told before it writes that no probe is left.
    const prompts = helpers.model.requests.filter((r) => r.purpose === 'interviewer-reply');
    expect(prompts.at(-1)!.messages[0]!.text).toContain('Your last two lines were probes: no probe now.');
  });

  it('writes a probe again when the check finds it names the mistake or the fix', async () => {
    const helpers = await turns(
      [
        probe("Sorting loses the original positions, so you'd need to keep them alongside."),
        probe('Which positions does that give back: the sorted ones or the original ones?'),
      ],
      [verdict({ namesMistake: true }), verdict()],
      ['sort it in place, then two pointers, return l and r'],
    );

    expect(helpers.spoken()).toEqual(['Which positions does that give back: the sorted ones or the original ones?']);
    expect(helpers.modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['mistake-unasked'] }]);
    const check = helpers.model.requests.find((r) => r.purpose === 'reply-check')!;
    expect(check.system).toContain('A probe');
  });

  it('never probes while they are still working something out', async () => {
    const helpers = await turns(
      [probe('What does seen hold after index 1?', { heard: 'thinking-aloud' }), reply('backchannel', 'Mm-hm.', { heard: 'thinking-aloud' })],
      [],
      ['so seen[5] = 0, then seen[1] = 0, hmm, let me keep going'],
    );

    expect(helpers.modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['probe-mid-work'] }]);
    expect(helpers.interviewer.record().asked).toEqual([]);
  });

  it('does not credit a mistake found right after a probe as their own, nor count it as a missed bug', async () => {
    const helpers = await turns(
      [
        probe('What does seen hold by the time the loop ends?', { heard: 'done', saysCodeDone: true }),
        reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer', foundOwnMistake: true }),
      ],
      [verdict()],
      ["done, it's O(n) time and O(1) space", 'oh, seen can hold every value, so O(n) space'],
    );

    const record = helpers.interviewer.record();
    expect(record.mistakes).toEqual([{ lineId: 't4', foundBy: 'candidate-after-probe' }]);
    expect(roundFacts(record).doneWithMissedBug).toBe(false);
    const grader = strongGrader();
    const feedback = await gradeRound({ model: grader.model, problem, record, rough: false });
    // Never checked their code on their own, so mixed at best; the probe doesn't make it a missed bug.
    expect(feedback.areas.testing.score).toBe(2);
    expect(grader.requests[0]!.messages[0]!.text).toContain("by the candidate, right after the interviewer's probe t4");
  });
});

describe('a reply for the phase the turn moved to', () => {
  async function turns(script: ModelScript['interviewer-reply'], checks: ModelScript['reply-check'], said: string[]) {
    const helpers = await afterIntro(script, checks);
    for (const text of said) {
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
      helpers.wait(5_000);
    }
    return helpers;
  }

  it('writes an offer to move on again for the new phase: complexity given during Test gets the first follow-up, not a wrap-up', async () => {
    const helpers = await turns(
      [
        ack('Okay.', 'test'),
        reply('offer-next-phase', 'Okay, that makes sense. Shall we wrap up there?', { heard: 'answering-interviewer', movesTo: 'complexity' }),
        reply('answer', 'What if the list were sorted?', { heard: 'answering-interviewer', asks: 'follow-up' }),
      ],
      [],
      ['let me test it', "sure, I think it's O(n) time and space"],
    );

    expect(helpers.spoken()).toEqual(['Okay.', 'What if the list were sorted?']);
    expect(helpers.events.filter((e) => e.kind === 'suggest-phase')).toEqual([]);
    expect(helpers.interviewer.record().phases.map((p) => p.phase)).toEqual(['clarify', 'test', 'complexity', 'follow-up']);
    // The second writing is told the phase the turn moved to, and why it's written again.
    const rewrite = helpers.model.requests.filter((r) => r.purpose === 'interviewer-reply').at(-1)!.messages[0]!.text;
    expect(rewrite).toContain('- Phase: Complexity');
    expect(rewrite).toContain('ask the first follow-up question');
    expect(helpers.modelCalls().at(-1)).toMatchObject({ outcome: 'spoken', rejected: ['written-for-old-phase'] });
  });

  it('costs no extra call when the candidate asked to move on and the reply says yes', async () => {
    const helpers = await turns([reply('offer-next-phase', 'Yes, go ahead.', { heard: 'asking-to-move-on', movesTo: 'code' })], [], ['should I start coding?']);

    expect(helpers.spoken()).toEqual(['Yes, go ahead.']);
    expect(helpers.model.requests).toHaveLength(1);
  });
});

describe("the candidate's own questions and offers", () => {
  async function turns(script: ModelScript['interviewer-reply'], said: string[]) {
    const helpers = await afterIntro(script);
    for (const text of said) {
      helpers.interviewer.onSignal({ type: 'said', text });
      helpers.wait(1_000);
      await settle();
      helpers.wait(5_000);
    }
    return helpers;
  }

  it('tells the model to answer a question put to it inside a turn first, whatever the turn mainly is', async () => {
    const helpers = await turns(
      [reply('acknowledgement', "No need, that's clear.", { heard: 'answering-interviewer' })],
      ['two pointers from both ends: too big, move right; too small, move left. do you want me to briefly explain why this works?'],
    );

    expect(helpers.model.requests[0]!.messages[0]!.text).toContain('If their turn asks you something');
  });

  it('asks for nothing by saying yes to their offer: the trace they offered stays their own', async () => {
    const helpers = await turns(
      [
        reply('answer', 'Yes, go ahead and trace it.', { heard: 'asking-to-move-on', movesTo: 'test', saysCodeDone: true, asks: 'trace-example' }),
        reply('acknowledgement', 'Okay.', { heard: 'answering-interviewer', checkedCode: true }),
      ],
      ['i think this works, do u want me to trace with an example?', '[5, 1, 5] with target 10: seen[5] = 0, seen[1] = 1, then 10 - 5 is in seen, so [0, 2]'],
    );

    const record = helpers.interviewer.record();
    expect(record.asked).toEqual([]);
    expect(record.checks).toEqual([{ lineId: 't4', by: 'candidate' }]);
  });

  it('is told this is practice with no real company, so it never invents a team, role or company', async () => {
    const helpers = await turns(
      [reply('answer', "This is a practice round, so there's no real team behind it. Happy to talk about the problem, though.", { heard: 'small-talk' })],
      ["what's the team like day to day?"],
    );

    const prompt = helpers.model.requests[0]!.messages[0]!.text;
    expect(prompt).toContain('practice round with no real company');
    expect(prompt).toContain('never invent a team or role');
  });
});
