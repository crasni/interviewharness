import { describe, expect, it } from 'vitest';
import {
  createFloorManager,
  type Decision,
  fallbackSituation,
  floorRules,
  type FloorLogEntry,
  type FloorManagerOptions,
  type LaterPhase,
  type Signal,
  startRound,
  type TurnReplyKind,
} from './index.ts';
import { fakeClock, fakeLog, testLines } from './test/fakes.ts';

/** The test's stand-in for the model's understanding of a sentence. */
function understood(text: string): { as: TurnReplyKind; agreed: boolean } {
  if (/^(hmm|uh)/i.test(text)) return { as: 'quiet', agreed: false };
  if (/^so (if|then)/i.test(text)) return { as: 'backchannel', agreed: false };
  if (/^(yes|sure)\b/i.test(text)) return { as: 'ack', agreed: true };
  if (/that'?s it|i'?m done/i.test(text)) return { as: 'offer', agreed: false };
  return { as: text.endsWith('?') ? 'answer' : 'ack', agreed: false };
}

function setup({ skipIntro = true, ...heldBack }: { skipIntro?: boolean } & Pick<FloorManagerOptions, 'checkInsHeldBack' | 'timeHeldBack'> = {}) {
  const clock = fakeClock(10_000);
  const log = fakeLog<FloorLogEntry>();
  const round = startRound('coding', clock);
  const lines = testLines();
  const manager = createFloorManager({ clock, round, lines, log, ...heldBack });
  // The words for each reply arrive at once, as the example line for it: these tests are about the
  // Floor Manager's timing, not about where the words come from (the interviewer's tests cover that).
  // What the candidate meant is the model's to understand; here a stand-in reads the test's own sentences.
  let lastSaid = '';
  let offered: LaterPhase | null = null;
  const floor = {
    onSignal(signal: Signal): Decision {
      if (signal.type === 'said') lastSaid = signal.text;
      const decision = manager.onSignal(signal);
      if (decision.kind !== 'preparing') return decision;
      const line = lines.next(fallbackSituation(decision.reply));
      let spoken: Decision;
      if (decision.reply.kind !== 'turn') {
        spoken = manager.onSignal({ type: 'words', line });
      } else {
        const { as, agreed } = understood(lastSaid);
        // Agreeing to an offer: the model hears the conversation in the offered phase.
        if (agreed && offered) manager.onSignal({ type: 'phase-reached', phase: offered });
        spoken = manager.onSignal({ type: 'words', line, as });
      }
      if (spoken.kind === 'suggest-phase') offered = spoken.next;
      return spoken;
    },
  };

  /** Advances time in 100 ms ticks, as the app does, and returns every decision made. */
  function wait(ms: number) {
    const decisions = [];
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      clock.advance(100);
      decisions.push(floor.onSignal({ type: 'tick' }));
    }
    return decisions;
  }

  // Most rules are about what happens after the interviewer's intro, so let it play and start clean.
  if (skipIntro) {
    wait(10_000);
    log.entries.length = 0;
  }

  return { clock, log, floor, round, wait };
}

/** The candidate says they're done and the interviewer offers the next phase; returns the helpers. */
function offered() {
  const helpers = setup();
  helpers.floor.onSignal({ type: 'said', text: "I think that's it." });
  helpers.wait(1_000);
  return helpers;
}

describe('the Floor Manager', () => {
  it('stays silent while the candidate is talking', () => {
    const { floor, wait } = setup();

    floor.onSignal({ type: 'talk-start' });
    const decisions = wait(10_000);

    expect(decisions.every((d) => d.kind === 'silent')).toBe(true);
  });

  it('gives a backchannel when the candidate pauses briefly mid-turn', () => {
    const { floor, wait } = setup();

    floor.onSignal({ type: 'talk-start' });
    wait(3_000);
    floor.onSignal({ type: 'talk-end' });
    const decisions = wait(1_200);

    expect(decisions.filter((d) => d.kind !== 'silent')).toEqual([{ kind: 'backchannel', line: 'Mm-hm.' }]);
    // Not instantly: a beat of silence comes first.
    expect(decisions.slice(0, 5).every((d) => d.kind === 'silent')).toBe(true);
  });

  it('gives at most one backchannel every several seconds', () => {
    const { floor, wait } = setup();
    const pauseAfterTalking = (talkMs: number) => {
      floor.onSignal({ type: 'talk-start' });
      wait(talkMs);
      floor.onSignal({ type: 'talk-end' });
      return wait(1_200).filter((d) => d.kind === 'backchannel').length;
    };

    expect(pauseAfterTalking(2_000)).toBe(1);
    expect(pauseAfterTalking(2_000)).toBe(0); // ~3 s after the last one: too soon
    expect(pauseAfterTalking(4_000)).toBe(1); // ~8 s after the last one
  });

  it('logs every decision with the signal and state behind it', () => {
    const { floor, log, wait } = setup();

    floor.onSignal({ type: 'talk-start' });
    wait(2_000);
    floor.onSignal({ type: 'talk-end' });
    wait(1_000);

    expect(log.entries).toEqual([
      { at: 20_000, signal: { type: 'talk-start' }, decision: { kind: 'silent' }, state: { talking: true, interviewerSpeaking: false, interviewerPreparing: false, talkMs: 0, silenceMs: null, sinceBackchannelMs: null, idleMs: 0, checkIns: 0, roundLeftMs: 2_690_000, phase: 'clarify', phaseElapsedMs: 10_000, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0, checkInsHeldBack: null, timeHeldBack: null } },
      { at: 22_000, signal: { type: 'talk-end' }, decision: { kind: 'silent' }, state: { talking: false, interviewerSpeaking: false, interviewerPreparing: false, talkMs: 2_000, silenceMs: 0, sinceBackchannelMs: null, idleMs: 0, checkIns: 0, roundLeftMs: 2_688_000, phase: 'clarify', phaseElapsedMs: 12_000, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0, checkInsHeldBack: null, timeHeldBack: null } },
      {
        at: 22_800,
        signal: { type: 'tick' },
        decision: { kind: 'backchannel', line: 'Mm-hm.' },
        state: { talking: false, interviewerSpeaking: false, interviewerPreparing: false, talkMs: 2_000, silenceMs: 800, sinceBackchannelMs: 0, idleMs: 800, checkIns: 0, roundLeftMs: 2_687_200, phase: 'clarify', phaseElapsedMs: 12_800, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0, checkInsHeldBack: null, timeHeldBack: null },
      },
    ]);
  });

  it('does not backchannel a tap: the candidate has to have said something', () => {
    const { floor, wait } = setup();

    floor.onSignal({ type: 'talk-start' });
    wait(200);
    floor.onSignal({ type: 'talk-end' });

    expect(wait(2_000).every((d) => d.kind === 'silent')).toBe(true);
  });

  it('logs a pause it stayed quiet for because of the cooldown, with the reason visible', () => {
    const { floor, log, wait } = setup();
    const talkThenPause = () => {
      floor.onSignal({ type: 'talk-start' });
      wait(2_000);
      floor.onSignal({ type: 'talk-end' });
      wait(1_000);
    };

    talkThenPause();
    talkThenPause();

    const pauseDecisions = log.entries.filter((e) => e.signal.type === 'tick');
    expect(pauseDecisions.map((e) => e.decision.kind)).toEqual(['backchannel', 'silent']);
    expect(pauseDecisions[1]!.state.sinceBackchannelMs).toBe(3_000);
  });

  describe('when the candidate ends their turn by saying something', () => {
    it('acknowledges a statement after a short beat', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });
      const decisions = wait(1_000).filter((d) => d.kind !== 'silent');

      expect(decisions).toEqual([{ kind: 'ack', line: 'Okay, that makes sense.', speakingMs: expect.any(Number) }]);
    });

    it('answers a question', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: 'Can the input be empty?' });
      const decisions = wait(1_000).filter((d) => d.kind !== 'silent');

      expect(decisions).toEqual([
        { kind: 'answer', line: expect.any(String), speakingMs: expect.any(Number) },
      ]);
    });

    it('never starts speaking while the candidate is talking again', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });
      wait(300);
      floor.onSignal({ type: 'talk-start' });

      expect(wait(5_000).every((d) => d.kind === 'silent')).toBe(true);
    });
  });

  describe('barge-in', () => {
    it('stops speaking when the candidate starts talking over it', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });
      wait(700); // the acknowledgement has started

      expect(floor.onSignal({ type: 'talk-start' })).toEqual({ kind: 'stop-speaking' });
    });

    it('has nothing to stop once it has finished speaking', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });
      wait(5_000);

      expect(floor.onSignal({ type: 'talk-start' })).toEqual({ kind: 'silent' });
    });

    it('stops speaking when the candidate says something over it, then responds to that', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });
      wait(700); // the acknowledgement has started

      expect(floor.onSignal({ type: 'said', text: 'Can the input be empty?' })).toEqual({ kind: 'stop-speaking' });
      expect(wait(1_000).filter((d) => d.kind !== 'silent').map((d) => d.kind)).toEqual(['answer']);
    });

    it('tells the room when it has finished speaking', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'I think a hash map works here.' });

      expect(wait(5_000).filter((d) => d.kind !== 'silent').map((d) => d.kind)).toEqual(['ack', 'done-speaking']);
    });
  });

  it('waits for the candidate to stop talking before responding to what they said', () => {
    const { floor, wait } = setup();
    floor.onSignal({ type: 'talk-start' });
    floor.onSignal({ type: 'said', text: 'I think a hash map works here.' }); // typed while still talking

    expect(wait(3_000).every((d) => d.kind === 'silent')).toBe(true);

    floor.onSignal({ type: 'talk-end' });
    expect(wait(1_000).filter((d) => d.kind !== 'silent').map((d) => d.kind)).toEqual(['ack']);
  });

  describe('held back', () => {
    const heldTicks = (log: { entries: FloorLogEntry[] }, field: 'checkInsHeldBack' | 'timeHeldBack') =>
      log.entries.filter((e) => e.signal.type === 'tick' && e.decision.kind === 'silent' && e.state[field] !== null);

    it('logs once, with the reason, a check-in that was due but held back because the candidate declined help', () => {
      const { wait, log } = setup({ checkInsHeldBack: () => 'declined-help' });

      const decisions = wait(3 * floorRules.checkInAfterIdle);

      expect(decisions.every((d) => d.kind === 'silent')).toBe(true);
      expect(heldTicks(log, 'checkInsHeldBack')).toEqual([expect.objectContaining({ state: expect.objectContaining({ checkInsHeldBack: 'declined-help' }) })]);
    });

    it('logs each time reminder and the closing line held back after the goodbye, with the reason', () => {
      const { wait, log } = setup({ checkInsHeldBack: () => 'said-goodbye', timeHeldBack: () => 'said-goodbye' });

      const decisions = wait(50 * 60_000);

      expect(decisions.every((d) => d.kind === 'silent')).toBe(true);
      // The first check-in held back, then the two reminders and the closing line, each logged at the tick it came due.
      expect(heldTicks(log, 'timeHeldBack').map((e) => Math.round(e.state.roundLeftMs / 60_000))).toEqual([42, 15, 5, 0]);
      expect(heldTicks(log, 'timeHeldBack').every((e) => e.state.timeHeldBack === 'said-goodbye')).toBe(true);
    });
  });

  describe('phases', () => {
    it('opens the round with an intro after a moment', () => {
      const { wait } = setup({ skipIntro: false });

      const decisions = wait(3_000);

      expect(decisions.slice(0, 5).every((d) => d.kind === 'silent')).toBe(true);
      expect(decisions.filter((d) => d.kind !== 'silent')[0]).toMatchObject({
        kind: 'intro',
        line: "Hi, thanks for joining. Let's start with the problem.",
      });
    });

    it('holds the intro while the candidate is already talking', () => {
      const { floor, wait } = setup({ skipIntro: false });
      floor.onSignal({ type: 'talk-start' });

      expect(wait(5_000).every((d) => d.kind === 'silent')).toBe(true);

      floor.onSignal({ type: 'talk-end' });
      expect(wait(1_000).find((d) => d.kind !== 'silent')).toMatchObject({ kind: 'intro' });
    });

    it('never pushes a phase on the clock: the candidate drives the round', () => {
      const { floor, round, wait } = setup();
      floor.onSignal({ type: 'said', text: 'I would use a hash map.' });

      const decisions = wait(40 * 60_000);

      expect(decisions.some((d) => d.kind === 'suggest-phase')).toBe(false);
      expect(round.snapshot().phase).toBe('clarify');
    });

    it('offers the next phase when the candidate is heard as done', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: "I think that's it." });

      expect(wait(1_000).find((d) => d.kind !== 'silent')).toMatchObject({ kind: 'suggest-phase', next: 'approach' });
    });

    it('moves on when the candidate agrees, in their own words', () => {
      const { floor, round, wait } = offered();
      wait(5_000);

      floor.onSignal({ type: 'said', text: "Sure, let's do it." });
      wait(1_000);

      expect(round.snapshot().phase).toBe('approach');
    });

    it('takes carrying on, instead of agreeing, as "not yet", and tells the room', () => {
      const { floor, round, wait } = offered();
      wait(5_000);

      floor.onSignal({ type: 'said', text: 'One more thing about negative numbers.' });

      expect(wait(1_000).map((d) => d.kind)).toContain('suggestion-withdrawn');
      expect(round.snapshot().phase).toBe('clarify');
    });

    it('withdraws an offer nobody answers', () => {
      const { wait } = offered();

      expect(wait(2 * 60_000).map((d) => d.kind)).toContain('suggestion-withdrawn');
    });
  });

  describe('replies that keep listening', () => {
    it('stays quiet when the model hears the candidate thinking aloud: it never takes the floor', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: 'hmm, so maybe two loops' });
      const decisions = wait(3_000).filter((d) => d.kind !== 'silent');

      expect(decisions).toEqual([{ kind: 'quiet' }]); // no line, so nothing to finish speaking
    });

    it('nods without taking the floor, when a brief "mm-hm" fits', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: 'so if I keep a map of seen values' });
      const decisions = wait(3_000).filter((d) => d.kind !== 'silent');

      expect(decisions.map((d) => d.kind)).toEqual(['backchannel']); // and no done-speaking: it never held the floor
    });
  });

  it('does not backchannel while it is speaking itself', () => {
    const { floor, wait } = setup({ skipIntro: false });
    floor.onSignal({ type: 'talk-start' });
    wait(2_000);
    floor.onSignal({ type: 'talk-end' }); // the intro starts now, while this pause is still young

    const decisions = wait(2_000).filter((d) => d.kind !== 'silent').map((d) => d.kind);

    expect(decisions).toEqual(['intro']);
  });

  describe('the end of the round', () => {
    it('is logged, closing any talk that was still going, and the interviewer says nothing after it', () => {
      const { floor, log, wait } = setup();
      floor.onSignal({ type: 'talk-start' });
      wait(2_000);

      expect(floor.onSignal({ type: 'round-end' })).toEqual({ kind: 'silent' });
      expect(log.entries.at(-1)).toMatchObject({
        signal: { type: 'round-end' },
        state: { talking: false, talkMs: 2_000 },
      });
      expect(wait(60 * 60_000).every((d) => d.kind === 'silent')).toBe(true);
    });
  });
});

describe('the check-in', () => {
  const checkIns = (decisions: Decision[]) => decisions.filter((d) => d.kind === 'check-in');

  it('says a line after a long stretch with no talking, saying or typing', () => {
    const { wait } = setup();

    const decisions = wait(floorRules.checkInAfterIdle + 1_000);

    expect(checkIns(decisions)).toEqual([
      { kind: 'check-in', nth: 1, line: 'Take your time. Talk it through whenever you like.', speakingMs: expect.any(Number) },
    ]);
  });

  it('checks in again if the silence goes on, waiting twice as long each time', () => {
    const { wait } = setup();
    const minute = 60_000;

    const at = wait(20 * minute)
      .map((d, tick) => [d, tick] as const)
      .filter(([d]) => d.kind === 'check-in')
      .map(([d, tick]) => [(d as { nth: number }).nth, Math.round((tick * 100) / 30_000) / 2]);

    // 2.5 minutes, then 5 more, then 10 more (plus a few seconds each time for the line itself).
    expect(at.map(([nth]) => nth)).toEqual([1, 2, 3]);
    expect(at.map(([, minutes]) => minutes)).toEqual([2.5, 7.5, 17.5]);
  });

  it('starts over once the candidate does something', () => {
    const { floor, wait } = setup();
    wait(floorRules.checkInAfterIdle + 1_000);

    floor.onSignal({ type: 'editor-activity' });

    expect(checkIns(wait(floorRules.checkInAfterIdle + 10_000))).toEqual([expect.objectContaining({ nth: 1 })]);
  });

  it('counts typing as doing something', () => {
    const { floor, wait } = setup();
    const decisions = [];

    for (let i = 0; i < 10; i++) {
      decisions.push(...wait(30_000));
      floor.onSignal({ type: 'editor-activity' });
    }

    expect(checkIns(decisions)).toHaveLength(0);
  });

  it('counts the silence from when the candidate stops talking, not from when they started', () => {
    const { floor, wait } = setup();
    floor.onSignal({ type: 'talk-start' });
    wait(floorRules.checkInAfterIdle + 30_000); // a long spoken turn, with nothing typed or said
    floor.onSignal({ type: 'talk-end' });

    expect(checkIns(wait(10_000))).toHaveLength(0);
  });

  it('never checks in while the candidate is talking', () => {
    const { floor, wait } = setup();
    floor.onSignal({ type: 'talk-start' });

    expect(checkIns(wait(3 * floorRules.checkInAfterIdle))).toHaveLength(0);
  });

  it('logs each check-in with the state behind it: a free floor, after the idle time', () => {
    const { log, wait } = setup();

    wait(30 * 60_000);

    // The moment it decided to check in, before the words arrived.
    const logged = log.entries.filter((e) => e.decision.kind === 'preparing' && e.decision.reply.kind === 'check-in');
    expect(logged.length).toBeGreaterThan(0);
    for (const entry of logged) {
      expect(entry.state).toMatchObject({ suggestedPhase: null, talking: false, interviewerSpeaking: false });
      expect(entry.state.idleMs).toBeGreaterThanOrEqual(floorRules.checkInAfterIdle);
    }
  });
});
