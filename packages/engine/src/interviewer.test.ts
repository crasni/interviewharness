import { describe, expect, it } from 'vitest';
import { createInterviewer, floorRules as floorRulesForTest, type InterviewerEvent, type ModelCallEntry, type Problem, replyRules, startRound } from './index.ts';
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

/** A structured reply to a question, as the model gives it: its words, and whether (and how much) it hinted. */
const answer = (words: string, { askedForHelp = false, hintLevel = 'none' }: { askedForHelp?: boolean; hintLevel?: string } = {}) => ({
  object: { words, askedForHelp, hintLevel },
});

/** Lets the model's promise settle: its words arrive between ticks, as they would from the network. */
const settle = () => new Promise<void>((resolve) => setTimeout(() => resolve(), 0));

/** Sets up past the intro, with its words already said, and the record cleared. */
async function afterIntro(script: ModelScript['interviewer-reply'] = []) {
  const helpers = setup({ script: { 'interviewer-reply': ['Hi, I am Sam. Take a look at the problem.', ...script] } });
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
    const { interviewer, wait, spoken } = await afterIntro(['Okay, go on.', 'Ready to talk through your approach?']);

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
      expect(spoken()).toEqual(['Good question. You can assume the input fits in memory.']);
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
      expect(spoken()).toEqual(['Good question. You can assume the input fits in memory.']);
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
      expect(spoken()).toEqual(['Good question. You can assume the input fits in memory.']);
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
        reply: 'answer',
        model: { provider: 'scripted', model: 'scripted-fake' },
        ms: 400, // asked 600 ms after the question; the words arrived when the test let them, after the ticks
        outcome: 'spoken',
        usage: { inputTokens: 0, outputTokens: 0 },
        hint: { askedForHelp: false, level: 'none' },
      },
    ]);
    expect(log.entries).toContainEqual(expect.objectContaining({ signal: { type: 'words', line: 'Yes.' } }));
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
      answer('Think about what you have already seen.', { askedForHelp: true, hintLevel: 'nudge' }),
      answer('Which value would complete the pair?', { askedForHelp: true, hintLevel: 'question' }),
    ]);

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
      answer('Keep a map from value to position.', { askedForHelp: true, hintLevel: 'concrete' }),
      answer('Think about what you have already seen.', { askedForHelp: true, hintLevel: 'nudge' }),
    ]);

    askForHelp(interviewer, wait);
    await settle();

    expect(spoken()).toEqual(['Think about what you have already seen.']);
    expect(modelCalls()).toMatchObject([{ outcome: 'spoken', rejected: ['hint-skipped-rung'], hint: { level: 'nudge' } }]);
  });

  it('never hints unasked: such a reply is written again, then replaced', async () => {
    const { interviewer, wait, spoken, modelCalls } = await afterIntro([
      answer('Yes. Also, try a hash map.', { askedForHelp: false, hintLevel: 'concrete' }),
      answer('Yes, and a map would help.', { askedForHelp: false, hintLevel: 'nudge' }),
    ]);

    interviewer.onSignal({ type: 'said', text: 'Can values repeat?' });
    wait(1_000);
    await settle();

    expect(spoken()).toEqual(['Good question. You can assume the input fits in memory.']);
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

    expect(spoken()).toEqual(['Good question. You can assume the input fits in memory.']);
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
  const { wait, spoken, modelCalls } = await afterIntro(['Want to walk me through where you are so far?']);

  wait(floorRulesForTest.checkInAfterIdle);
  await settle();

  expect(spoken()).toEqual(['Want to walk me through where you are so far?']);
  expect(modelCalls()).toMatchObject([{ reply: 'check-in', outcome: 'spoken' }]);
});
