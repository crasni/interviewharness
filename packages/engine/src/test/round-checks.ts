import type { ModelCallEntry, RoundLogEntry } from '../index.ts';

/** What a round's log shows went wrong, found in code: what the fake-candidate suite fails a run on. */
export interface RoundFailure {
  check: 'hint-unasked' | 'phase-not-moved-by-candidate' | 'reply-failed';
  /** The round time of the log entry it was found in. */
  at: number;
  detail: string;
}

type Entry = Record<string, unknown> & { at: number };
const signalOf = (entry: Entry) => entry.signal as { type: string; phase?: string } | undefined;
const decisionOf = (entry: Entry) => entry.decision as { kind: string; reply?: { kind: string }; line?: string; phase?: string } | undefined;

/**
 * Checks a round's log for what must never happen (ADR 0018, 0019): a hint the candidate didn't ask for, a phase
 * moved by anything but the candidate's turn (or the closing line at time), and a reply that failed.
 */
export function checkRound(log: readonly RoundLogEntry[]): RoundFailure[] {
  const failures: RoundFailure[] = [];
  // Whether the candidate has had a turn the interviewer hasn't replied to yet: what may move the phase.
  let theirTurn = false;
  let closing = false;
  for (const entry of log as unknown as readonly Entry[]) {
    const call = (entry as unknown as Partial<ModelCallEntry>).modelCall;
    if (call) {
      const hint = call.hint;
      if (call.outcome === 'spoken' && hint && hint.level !== 'none' && !hint.askedForHelp) {
        failures.push({ check: 'hint-unasked', at: entry.at, detail: `a ${hint.level} after "${call.heard ?? call.reply}"` });
      }
      if (call.outcome === 'failed') {
        failures.push({ check: 'reply-failed', at: entry.at, detail: `${call.error ?? 'error'} after ${(call.ms / 1000).toFixed(1)} s` });
      }
      continue;
    }
    const signal = signalOf(entry);
    const decision = decisionOf(entry);
    if (signal?.type === 'said') theirTurn = true;
    if (decision?.kind === 'preparing') closing = decision.reply?.kind === 'closing';
    if (decision?.kind === 'phase-moved' && !theirTurn && !(closing && decision.phase === 'wrap-up')) {
      failures.push({ check: 'phase-not-moved-by-candidate', at: entry.at, detail: `moved to ${decision.phase}` });
    }
    // The interviewer's spoken line ends the reply to their turn.
    if (signal?.type === 'words' && decision?.line) theirTurn = false;
  }
  return failures;
}

export interface ReplyTimes {
  /** The kind of reply; a reply to a turn also says what the model heard ("turn: done"). */
  kind: string;
  count: number;
  medianMs: number;
  slowestMs: number;
}

/** How long replies took, by kind, in the order each kind first came: only replies that ran to their end. */
export function replyTimes(log: readonly RoundLogEntry[]): ReplyTimes[] {
  const byKind = new Map<string, number[]>();
  for (const entry of log) {
    const call = (entry as Partial<ModelCallEntry>).modelCall;
    // A reply cut off by a barge-in or a newer turn says nothing about how fast the model is.
    if (!call || call.outcome === 'aborted' || call.outcome === 'late-reply-dropped') continue;
    const kind = call.reply === 'turn' && call.heard ? `turn: ${call.heard}` : call.reply;
    byKind.set(kind, [...(byKind.get(kind) ?? []), call.ms]);
  }
  return [...byKind].map(([kind, times]) => {
    const sorted = [...times].sort((a, b) => a - b);
    return { kind, count: sorted.length, medianMs: sorted[Math.floor((sorted.length - 1) / 2)]!, slowestMs: sorted.at(-1)! };
  });
}
