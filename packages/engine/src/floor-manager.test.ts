import { describe, expect, it } from 'vitest';
import { createFloorManager } from './index.ts';
import { fakeClock, fakeLog, testLines } from './test/fakes.ts';

function setup() {
  const clock = fakeClock(10_000);
  const log = fakeLog();
  const floor = createFloorManager({ clock, lines: testLines(), log });

  /** Advances time in 100 ms ticks, as the app does, and returns every decision made. */
  function wait(ms: number) {
    const decisions = [];
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      clock.advance(100);
      decisions.push(floor.onSignal({ type: 'tick' }));
    }
    return decisions;
  }

  return { clock, log, floor, wait };
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
      { at: 10_000, signal: { type: 'talk-start' }, decision: { kind: 'silent' }, state: { talking: true, interviewerSpeaking: false, talkMs: 0, silenceMs: null, sinceBackchannelMs: null, lastSaid: null } },
      { at: 12_000, signal: { type: 'talk-end' }, decision: { kind: 'silent' }, state: { talking: false, interviewerSpeaking: false, talkMs: 2_000, silenceMs: 0, sinceBackchannelMs: null, lastSaid: null } },
      {
        at: 12_800,
        signal: { type: 'tick' },
        decision: { kind: 'backchannel', line: 'Mm-hm.' },
        state: { talking: false, interviewerSpeaking: false, talkMs: 2_000, silenceMs: 800, sinceBackchannelMs: 0, lastSaid: null },
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
});
