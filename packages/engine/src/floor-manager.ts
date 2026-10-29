import type { LineBook } from './lines.ts';
import type { Clock } from './round.ts';

/** Something the candidate did, or the passing of time. */
export type Signal = { type: 'talk-start' } | { type: 'talk-end' } | { type: 'tick' };

/** What the interviewer does at this moment. */
export type Decision = { kind: 'silent' } | { kind: 'backchannel'; line: string };

/** What the Floor Manager knew when it decided. */
export interface FloorState {
  talking: boolean;
  /** How long the candidate's current (or most recent) stretch of talking lasted. */
  talkMs: number;
  /** How long the candidate has been silent, or null before they first talk. */
  silenceMs: number | null;
  /** Time since the last backchannel, or null if there hasn't been one. */
  sinceBackchannelMs: number | null;
}

export interface FloorLogEntry {
  at: number;
  signal: Signal;
  decision: Decision;
  state: FloorState;
}

export interface FloorLog {
  write(entry: FloorLogEntry): void;
}

export interface FloorManager {
  onSignal(signal: Signal): Decision;
}

export interface FloorManagerOptions {
  clock: Clock;
  lines: LineBook;
  log: FloorLog;
}

/** Timing rules, in milliseconds. Fixed defaults for now (no persona knobs, ADR 0014). */
export const floorRules = {
  /** Silence after the candidate stops talking before a backchannel (BLUEPRINT §3.3: 600–1200 ms). */
  backchannelAfterSilence: 800,
  /** Shortest gap between two backchannels, so they never become a tic (BLUEPRINT §3.3: 8–10 s). */
  backchannelCooldown: 8_000,
  /** Talking shorter than this is a tap, not something said; it gets no backchannel. */
  backchannelMinTalk: 1_000,
};

/** Decides *whether* the interviewer speaks at each moment, never *what* the substance is. */
export function createFloorManager({ clock, lines, log }: FloorManagerOptions): FloorManager {
  let talkingSince: number | null = null;
  let talkMs = 0;
  // When the candidate last stopped talking; null until they have talked at all.
  let silentSince: number | null = null;
  // Each pause is weighed once, when it is long enough for a backchannel.
  let pauseWeighed = false;
  let lastBackchannelAt: number | null = null;

  function stateAt(now: number): FloorState {
    return {
      talking: talkingSince !== null,
      talkMs: talkingSince !== null ? now - talkingSince : talkMs,
      silenceMs: silentSince === null ? null : now - silentSince,
      sinceBackchannelMs: lastBackchannelAt === null ? null : now - lastBackchannelAt,
    };
  }

  /** Returns the decision, and whether it is worth logging. */
  function decide(signal: Signal, now: number): [Decision, boolean] {
    switch (signal.type) {
      case 'talk-start':
        talkingSince = now;
        silentSince = null;
        return [silent, true];

      case 'talk-end':
        if (talkingSince === null) return [silent, true];
        talkMs = now - talkingSince;
        talkingSince = null;
        silentSince = now;
        pauseWeighed = false;
        return [silent, true];

      case 'tick': {
        // A quiet tick ten times a second would bury the decisions worth replaying,
        // so only the tick that weighs a pause is logged, whatever it decides.
        if (silentSince === null || pauseWeighed) return [silent, false];
        if (now - silentSince < floorRules.backchannelAfterSilence) return [silent, false];
        pauseWeighed = true;
        const coolingDown = lastBackchannelAt !== null && now - lastBackchannelAt < floorRules.backchannelCooldown;
        if (talkMs < floorRules.backchannelMinTalk || coolingDown) return [silent, true];
        lastBackchannelAt = now;
        return [{ kind: 'backchannel', line: lines.next('backchannel') }, true];
      }
    }
  }

  return {
    onSignal(signal) {
      const now = clock.now();
      const [decision, worthLogging] = decide(signal, now);
      if (worthLogging) log.write({ at: now, signal, decision, state: stateAt(now) });
      return decision;
    },
  };
}

const silent: Decision = { kind: 'silent' };
