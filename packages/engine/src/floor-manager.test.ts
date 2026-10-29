import { describe, expect, it } from 'vitest';
import { createFloorManager, startRound } from './index.ts';
import { fakeClock, fakeLog, testLines } from './test/fakes.ts';

function setup({ skipIntro = true } = {}) {
  const clock = fakeClock(10_000);
  const log = fakeLog();
  const round = startRound('coding', clock);
  const floor = createFloorManager({ clock, round, lines: testLines(), log });

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

/** Waits (up to 30 min) until the interviewer suggests moving on, then accepts. Returns the move-on decision. */
function acceptNextSuggestion({ floor, wait }: ReturnType<typeof setup>) {
  for (let i = 0; i < 180 && !wait(10_000).some((d) => d.kind === 'suggest-phase'); i++);
  return floor.onSignal({ type: 'phase-answer', accept: true });
}

/** Lets Clarify run long, waits for the suggestion to finish, and returns the helpers. */
function suggested() {
  const helpers = setup();
  helpers.wait(5 * 60_000 + 5_000);
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
      { at: 20_000, signal: { type: 'talk-start' }, decision: { kind: 'silent' }, state: { talking: true, interviewerSpeaking: false, talkMs: 0, silenceMs: null, sinceBackchannelMs: null, lastSaid: null, quietAfterTurnMs: null, phase: 'clarify', phaseElapsedMs: 10_000, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0 } },
      { at: 22_000, signal: { type: 'talk-end' }, decision: { kind: 'silent' }, state: { talking: false, interviewerSpeaking: false, talkMs: 2_000, silenceMs: 0, sinceBackchannelMs: null, lastSaid: null, quietAfterTurnMs: null, phase: 'clarify', phaseElapsedMs: 12_000, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0 } },
      {
        at: 22_800,
        signal: { type: 'tick' },
        decision: { kind: 'backchannel', line: 'Mm-hm.' },
        state: { talking: false, interviewerSpeaking: false, talkMs: 2_000, silenceMs: 800, sinceBackchannelMs: 0, lastSaid: null, quietAfterTurnMs: null, phase: 'clarify', phaseElapsedMs: 12_800, suggestedPhase: null, notYets: 0, suggestAgainInMs: 0 },
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
        { kind: 'answer', line: 'Good question. You can assume the input fits in memory.', speakingMs: expect.any(Number) },
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
    floor.onSignal({ type: 'said', text: 'I think a hash map works here.' }); // typed while still holding Space

    expect(wait(3_000).every((d) => d.kind === 'silent')).toBe(true);

    floor.onSignal({ type: 'talk-end' });
    expect(wait(1_000).filter((d) => d.kind !== 'silent').map((d) => d.kind)).toEqual(['ack']);
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

    it('suggests moving on when a phase runs past its share of the time', () => {
      const { wait, round } = setup();

      const suggestions = wait(5 * 60_000).filter((d) => d.kind === 'suggest-phase');

      expect(suggestions).toEqual([
        { kind: 'suggest-phase', next: 'approach', line: 'Want to talk through your approach?', speakingMs: expect.any(Number) },
      ]);
      expect(round.snapshot().phase).toBe('clarify'); // a suggestion, not a move
    });

    it('moves on when the candidate accepts', () => {
      const { floor, round } = suggested();

      const decision = floor.onSignal({ type: 'phase-answer', accept: true });

      expect(round.snapshot().phase).toBe('approach');
      expect(decision).toMatchObject({ kind: 'move-on', phase: 'approach', line: 'Sounds good.' });
    });

    it('keeps the phase when the candidate declines, and waits longer each time before asking again', () => {
      const { floor, round, wait } = suggested();
      const minutesUntilNextSuggestion = () => {
        for (let minute = 1; minute <= 30; minute++) {
          if (wait(60_000).some((d) => d.kind === 'suggest-phase')) return minute;
        }
        return null;
      };

      floor.onSignal({ type: 'phase-answer', accept: false });
      expect(minutesUntilNextSuggestion()).toBe(2);
      floor.onSignal({ type: 'phase-answer', accept: false });
      expect(minutesUntilNextSuggestion()).toBe(4);
      expect(round.snapshot().phase).toBe('clarify');
    });

    it('treats carrying on talking as "not yet"', () => {
      const { floor, round, wait } = suggested();

      floor.onSignal({ type: 'talk-start' });
      wait(3_000);
      floor.onSignal({ type: 'talk-end' });

      expect(round.snapshot().phase).toBe('clarify');
      expect(wait(60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('never moves on without the candidate agreeing', () => {
      const { round, wait } = suggested();

      wait(40 * 60_000);

      expect(round.snapshot().phase).toBe('clarify');
    });

    it('opens wrap-up by asking if the candidate has questions', () => {
      const helpers = setup();
      const { round, wait } = helpers;
      let decision;
      while (round.snapshot().phase !== 'wrap-up') decision = acceptNextSuggestion(helpers);

      expect(decision).toMatchObject({
        kind: 'move-on',
        phase: 'wrap-up',
        line: "That's about time. Do you have any questions for me?",
      });
      expect(wait(20 * 60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('suggests moving on when the candidate says they are done', () => {
      const { floor, wait } = setup();

      floor.onSignal({ type: 'said', text: "I think that's it." });
      const spokenNext = wait(1_000).find((d) => d.kind !== 'silent');

      expect(spokenNext).toMatchObject({ kind: 'suggest-phase', next: 'approach' });
    });

    it('suggests moving on after a long silence once the candidate has finished their turn', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'So the input is a list of integers.' });

      const decisions = wait(20_000).filter((d) => d.kind !== 'silent').map((d) => d.kind);

      expect(decisions.slice(0, 3)).toEqual(['ack', 'done-speaking', 'suggest-phase']);
    });

    it('does not take a pause mid-turn for being done', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'talk-start' });
      wait(3_000);
      floor.onSignal({ type: 'talk-end' });

      expect(wait(60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('holds the intro while the candidate is already talking', () => {
      const { floor, wait } = setup({ skipIntro: false });
      floor.onSignal({ type: 'talk-start' });

      expect(wait(5_000).every((d) => d.kind === 'silent')).toBe(true);

      floor.onSignal({ type: 'talk-end' });
      expect(wait(1_000).find((d) => d.kind !== 'silent')).toMatchObject({ kind: 'intro' });
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

  describe('phases: regressions from review', () => {
    function inPhaseAfterMoveOn() {
      const helpers = setup();
      const { floor, wait } = helpers;
      floor.onSignal({ type: 'said', text: 'The input is a list of integers.' }); // the candidate has spoken
      wait(5 * 60_000);
      floor.onSignal({ type: 'phase-answer', accept: true });
      return helpers;
    }

    it('does not take the quiet right after moving on as being done', () => {
      const { round, wait } = inPhaseAfterMoveOn();

      expect(round.snapshot().phase).toBe('approach');
      expect(wait(60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('stays quiet in wrap-up, even after the candidate has spoken', () => {
      const helpers = setup();
      const { floor, round, wait } = helpers;
      while (round.snapshot().phase !== 'wrap-up') acceptNextSuggestion(helpers);
      floor.onSignal({ type: 'said', text: 'How big is the team?' });
      floor.onSignal({ type: 'said', text: 'Thanks, that was helpful.' });

      expect(() => wait(60_000)).not.toThrow();
      expect(wait(60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('accepts a suggestion said in words', () => {
      const { floor, round, wait } = suggested();

      floor.onSignal({ type: 'said', text: "Yes, let's move on." });
      wait(1_000);

      expect(round.snapshot().phase).toBe('approach');
    });

    it('does not take the quiet after answering a question as being done', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: 'Can the readings be negative?' });

      expect(wait(60_000).some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('suggests moving on when the candidate says they are done, even soon after a "not yet"', () => {
      const { floor, wait } = suggested();
      floor.onSignal({ type: 'phase-answer', accept: false });
      wait(10_000);

      floor.onSignal({ type: 'said', text: "Okay, I think that's it." });

      expect(wait(1_000).find((d) => d.kind !== 'silent')).toMatchObject({ kind: 'suggest-phase' });
    });

    it('withdraws a suggestion nobody answers, and can suggest again later', () => {
      const { wait } = suggested();

      const kinds = wait(5 * 60_000).filter((d) => d.kind !== 'silent').map((d) => d.kind);

      expect(kinds[0]).toBe('suggestion-withdrawn');
      expect(kinds).toContain('suggest-phase');
    });

    it('tells the room when carrying on talking withdraws the suggestion', () => {
      const { floor, wait } = suggested();

      floor.onSignal({ type: 'talk-start' });

      expect(wait(200).map((d) => d.kind)).toContain('suggestion-withdrawn');
    });
  });

  describe('editor activity', () => {
    it('is not quiet: typing code keeps the interviewer from taking silence as "done"', () => {
      const { floor, wait } = setup();
      floor.onSignal({ type: 'said', text: "Okay, I'll write it now." });
      wait(3_000); // acknowledged

      const decisions = [];
      for (let second = 0; second < 30; second++) {
        floor.onSignal({ type: 'editor-activity' });
        decisions.push(...wait(1_000));
      }

      expect(decisions.some((d) => d.kind === 'suggest-phase')).toBe(false);
    });

    it('does not answer a suggestion either way', () => {
      const { floor, wait } = suggested();

      floor.onSignal({ type: 'editor-activity' });

      expect(wait(1_000).some((d) => d.kind === 'suggestion-withdrawn')).toBe(false);
    });
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
