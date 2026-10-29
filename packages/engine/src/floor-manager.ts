import type { LineBook } from './lines.ts';
import type { Clock } from './round.ts';

/** Something the candidate did, or the passing of time. */
export type Signal =
  | { type: 'talk-start' }
  | { type: 'talk-end' }
  /** The candidate's words for their turn (typed for now); ends their turn. */
  | { type: 'said'; text: string }
  | { type: 'tick' };

/** A line the interviewer says aloud, holding the floor for about `speakingMs`. */
export type Spoken<K extends string> = { kind: K; line: string; speakingMs: number };

/** What the interviewer does at this moment. */
export type Decision =
  | { kind: 'silent' }
  | { kind: 'backchannel'; line: string }
  /** An acknowledgement: takes the floor briefly after the candidate's turn, then hands it back. */
  | Spoken<'ack'>
  | Spoken<'answer'>
  /** Barge-in: the candidate talked or said something over the interviewer, so it stops mid-line. */
  | { kind: 'stop-speaking' }
  /** The interviewer finished its line and hands the floor back. */
  | { kind: 'done-speaking' };

/** What the Floor Manager knew when it decided. */
export interface FloorState {
  talking: boolean;
  /** Whether the interviewer currently holds the floor. */
  interviewerSpeaking: boolean;
  /** How long the candidate's current (or most recent) stretch of talking lasted. */
  talkMs: number;
  /** How long the candidate has been silent, or null before they first talk. */
  silenceMs: number | null;
  /** Time since the last backchannel, or null if there hasn't been one. */
  sinceBackchannelMs: number | null;
  /** Whether the candidate's last words were a question or a statement, or null before they say anything. */
  lastSaid: 'question' | 'statement' | null;
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
  /** The beat between the candidate finishing their turn and the interviewer responding. */
  respondAfter: 600,
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
  // The candidate ended their turn and the interviewer owes them a response from this time on.
  let responseDueAt: number | null = null;
  let lastSaid: FloorState['lastSaid'] = null;
  let speakingUntil: number | null = null;

  const isSpeaking = (now: number) => speakingUntil !== null && now < speakingUntil;

  function stateAt(now: number): FloorState {
    return {
      talking: talkingSince !== null,
      interviewerSpeaking: isSpeaking(now),
      talkMs: talkingSince !== null ? now - talkingSince : talkMs,
      silenceMs: silentSince === null ? null : now - silentSince,
      sinceBackchannelMs: lastBackchannelAt === null ? null : now - lastBackchannelAt,
      lastSaid,
    };
  }

  /** Stops the interviewer mid-line if it is speaking. */
  function bargeIn(now: number): Decision {
    if (!isSpeaking(now)) return silent;
    speakingUntil = null;
    return { kind: 'stop-speaking' };
  }

  function respond(now: number): Decision {
    responseDueAt = null;
    silentSince = null; // this silence was the end of their turn, not a pause to backchannel
    const decision =
      lastSaid === 'question'
        ? spoken('answer', lines.next('answer'))
        : spoken('ack', lines.next('acknowledgement'));
    speakingUntil = now + decision.speakingMs;
    return decision;
  }

  /** Returns the decision, and whether it is worth logging. */
  function decide(signal: Signal, now: number): [Decision, boolean] {
    switch (signal.type) {
      case 'talk-start':
        talkingSince = now;
        silentSince = null;
        responseDueAt = null; // they kept the floor: the response they were owed no longer fits
        return [bargeIn(now), true];

      case 'talk-end':
        if (talkingSince === null) return [silent, true];
        talkMs = now - talkingSince;
        talkingSince = null;
        silentSince = now;
        pauseWeighed = false;
        // Words typed while talking end the turn once the talking stops, after the usual beat.
        if (responseDueAt !== null) responseDueAt = Math.max(responseDueAt, now + floorRules.respondAfter);
        return [silent, true];

      case 'said': {
        const text = signal.text.trim();
        if (!text) return [silent, true];
        lastSaid = text.endsWith('?') ? 'question' : 'statement';
        silentSince = null; // their turn is over: no backchannel for this pause
        responseDueAt = now + floorRules.respondAfter;
        return [bargeIn(now), true];
      }

      case 'tick': {
        if (speakingUntil !== null && !isSpeaking(now)) {
          speakingUntil = null;
          return [{ kind: 'done-speaking' }, true];
        }
        if (responseDueAt !== null && talkingSince === null && now >= responseDueAt) return [respond(now), true];
        // A quiet tick ten times a second would bury the decisions worth replaying,
        // so only the tick that weighs a pause is logged, whatever it decides.
        if (silentSince === null || pauseWeighed || responseDueAt !== null) return [silent, false];
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

function spoken<K extends string>(kind: K, line: string): Spoken<K> {
  return { kind, line, speakingMs: speakingTime(line) };
}

/** Roughly how long a line takes to say aloud: about 15 characters a second, at least a second. */
function speakingTime(line: string) {
  return Math.max(1_000, Math.round((line.length / 15) * 1_000));
}
