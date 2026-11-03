import { describe, expect, it } from 'vitest';
import type { RoundLogEntry } from '../index.ts';
import { checkRound, replyTimes } from './round-checks.ts';

// Hand-written logs, only the fields the checks read: what the candidate said, what moved the phase, and each model call.
const said = (at: number, text: string) => ({ at, signal: { type: 'said', text }, decision: { kind: 'silent' } }) as unknown as RoundLogEntry;
const spoke = (at: number, line: string) => ({ at, signal: { type: 'words', line }, decision: { kind: 'answer', line } }) as unknown as RoundLogEntry;
const preparing = (at: number, kind: string) => ({ at, signal: { type: 'tick' }, decision: { kind: 'preparing', reply: { kind } } }) as unknown as RoundLogEntry;
const moved = (at: number, phase: string) => ({ at, signal: { type: 'phase-reached', phase }, decision: { kind: 'phase-moved', phase } }) as unknown as RoundLogEntry;
const call = (at: number, fields: Record<string, unknown>) =>
  ({ at, modelCall: { id: at, purpose: 'interviewer-reply', reply: 'turn', model: { provider: 'p', model: 'm' }, ms: 5_000, outcome: 'spoken', ...fields } }) as unknown as RoundLogEntry;

describe("checking a round's log", () => {
  it('passes a round where help was asked for and the candidate moved the phase', () => {
    const log = [
      said(1_000, "I'll code it now."),
      moved(1_500, 'code'),
      call(6_000, { heard: 'explaining', hint: { askedForHelp: false, level: 'none' } }),
      spoke(6_000, 'Okay.'),
      said(9_000, 'Can I get a hint?'),
      call(14_000, { heard: 'asking-for-help', hint: { askedForHelp: true, level: 'nudge' } }),
      spoke(14_000, 'Think about what you have seen.'),
    ];

    expect(checkRound(log)).toEqual([]);
  });

  it('fails a hint nobody asked for', () => {
    const log = [said(1_000, 'Here is my loop.'), call(6_000, { heard: 'explaining', hint: { askedForHelp: false, level: 'nudge' } }), spoke(6_000, 'Try a map.')];

    expect(checkRound(log)).toEqual([{ check: 'hint-unasked', at: 6_000, detail: 'a nudge after "explaining"' }]);
  });

  it("fails a phase moved by the interviewer's own words, not the candidate's turn", () => {
    const log = [said(1_000, 'Hm.'), call(6_000, {}), spoke(6_000, "Let's test it."), moved(7_000, 'test')];

    expect(checkRound(log)).toEqual([{ check: 'phase-not-moved-by-candidate', at: 7_000, detail: 'moved to test' }]);
  });

  it('lets the closing line at time turn the round to Wrap-up', () => {
    const log = [said(1_000, 'Still coding.'), call(2_000, {}), spoke(2_000, 'Okay.'), preparing(3_000, 'closing'), moved(3_000, 'wrap-up')];

    expect(checkRound(log)).toEqual([]);
  });

  it('fails a reply that failed, saying why', () => {
    const log = [said(1_000, 'Can the list be empty?'), call(61_000, { outcome: 'failed', error: 'timeout', ms: 60_000 })];

    expect(checkRound(log)).toEqual([{ check: 'reply-failed', at: 61_000, detail: 'timeout after 60.0 s' }]);
  });
});

describe('reply times', () => {
  it('gives the median and slowest per kind of reply, a turn by what the model heard', () => {
    const log = [
      call(1, { reply: 'intro', ms: 4_000 }),
      call(2, { heard: 'explaining', ms: 5_000 }),
      call(3, { heard: 'explaining', ms: 7_000 }),
      call(4, { heard: 'explaining', ms: 6_000 }),
      call(5, { heard: 'done', ms: 16_000 }),
      call(6, { outcome: 'aborted', heard: 'done', ms: 200 }), // cut off by a barge-in: says nothing about speed
    ];

    expect(replyTimes(log)).toEqual([
      { kind: 'intro', count: 1, medianMs: 4_000, slowestMs: 4_000 },
      { kind: 'turn: explaining', count: 3, medianMs: 6_000, slowestMs: 7_000 },
      { kind: 'turn: done', count: 1, medianMs: 16_000, slowestMs: 16_000 },
    ]);
  });
});
