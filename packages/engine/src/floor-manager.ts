import type { LineBook } from './lines.ts';
import { createPhaseGuide, type MoveOnCue, type PhaseState } from './phases.ts';
import type { Clock, LaterPhase, Round } from './round.ts';

/** Something the candidate did, or the passing of time. */
export type Signal =
  | { type: 'talk-start' }
  | { type: 'talk-end' }
  /** The candidate's words for their turn (typed for now), with their code as it stood; ends their turn. */
  | { type: 'said'; text: string; code?: CodeSnapshot }
  /** The candidate's answer to a suggestion to move on: "Move on" or "Not yet". */
  | { type: 'phase-answer'; accept: boolean }
  /** The candidate is typing in the code editor. Sent at most about once a second. */
  | { type: 'editor-activity' }
  | { type: 'tick' }
  /** The round is over. Logged so a replay can tell an ended round from a crash; nothing is said after it. */
  | { type: 'round-end' }
  /** The words for the reply being prepared have arrived (from the model, or a fallback line). */
  | { type: 'words'; line: string };

/** The editor's contents at a moment: the code and its language. */
export interface CodeSnapshot {
  language: string;
  text: string;
}

/** A line the interviewer says aloud, holding the floor for about `speakingMs`. */
export type Spoken<K extends string> = { kind: K; line: string; speakingMs: number };

/**
 * A reply the Floor Manager has decided to give, before its words exist. The kind and the moment are
 * the Floor Manager's; the words come after, from the model.
 */
export type Reply =
  | { kind: 'ack' }
  | { kind: 'answer' }
  | { kind: 'intro' }
  /** `afterDone`: the candidate said they're done, so the words react to their work first. */
  | { kind: 'suggest-phase'; next: LaterPhase; afterDone: boolean }
  | { kind: 'move-on'; phase: LaterPhase };

/** What the interviewer does at this moment. */
export type Decision =
  | { kind: 'silent' }
  | { kind: 'backchannel'; line: string }
  /** The interviewer takes the floor and holds it quietly while the words for `reply` are written. */
  | { kind: 'preparing'; reply: Reply }
  /** An acknowledgement: takes the floor briefly after the candidate's turn, then hands it back. */
  | Spoken<'ack'>
  | Spoken<'answer'>
  /** Opens the round: greets the candidate and explains the format. */
  | Spoken<'intro'>
  /** Offers to move to the next phase. Only the candidate's agreement moves it. */
  | (Spoken<'suggest-phase'> & { next: LaterPhase })
  /** The candidate agreed; the round is now in `phase`. */
  | (Spoken<'move-on'> & { phase: LaterPhase })
  /** Barge-in: the candidate talked or said something over the interviewer, so it stops mid-line. */
  | { kind: 'stop-speaking' }
  /** Barge-in before the words arrived: the reply being prepared is dropped, and nothing was said. */
  | { kind: 'stop-preparing' }
  /** The interviewer finished its line and hands the floor back. */
  | { kind: 'done-speaking' }
  /** A suggestion to move on is off the table: the candidate carried on, or never answered. */
  | { kind: 'suggestion-withdrawn' };

/** What the Floor Manager knew when it decided. */
export interface FloorState extends PhaseState {
  talking: boolean;
  /** Whether the interviewer is saying a line. */
  interviewerSpeaking: boolean;
  /** Whether the interviewer holds the floor waiting for the words of its reply. */
  interviewerPreparing: boolean;
  /** How long the candidate's current (or most recent) stretch of talking lasted. */
  talkMs: number;
  /** How long the candidate has been silent, or null before they first talk. */
  silenceMs: number | null;
  /** Time since the last backchannel, or null if there hasn't been one. */
  sinceBackchannelMs: number | null;
  /** What the candidate's last words were: a question, a statement, or saying they're done. Null before they say anything. */
  lastSaid: 'question' | 'statement' | 'done' | null;
  /** Quiet since the interviewer acknowledged the candidate's finished turn, or null. Long enough reads as "done". */
  quietAfterTurnMs: number | null;
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
  round: Round;
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
  /** A moment of quiet after the round opens before the intro, so it doesn't start mid-click. */
  introAfter: 1_000,
  /**
   * Quiet after the interviewer acknowledges a finished statement that reads as "done with this phase".
   * Only after a statement: after answering a question, the candidate is likely still thinking.
   */
  doneAfterSilence: 15_000,
};

/** Words that mean the candidate is done with the current phase. */
const donePhrases = /\b(that'?s it|that'?s all|i'?m done|let'?s move on|ready to move on)\b/i;
/** Words that accept a pending suggestion to move on, said at the start of the candidate's turn. */
const acceptPhrases = /^(yes|yeah|yep|sure|ok(ay)?|sounds good|go ahead|let'?s (do it|go|move on))\b/i;

/** Decides *whether* the interviewer speaks at each moment, never *what* the substance is. */
export function createFloorManager({ clock, round, lines, log }: FloorManagerOptions): FloorManager {
  const phases = createPhaseGuide(round);
  const openedAt = clock.now();
  let introduced = false;
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
  // The reply whose words are on their way, and whether it acknowledges a finished statement.
  let preparing: { reply: Reply; turnAck: boolean } | null = null;
  // Whether the line being spoken acknowledges a finished statement; the quiet after it may mean "done".
  let speakingAck = false;
  let turnClosedAt: number | null = null;
  // A suggestion was withdrawn while handling a candidate signal; the next tick tells the room.
  let withdrawalToAnnounce = false;
  let ended = false;

  const isSpeaking = (now: number) => speakingUntil !== null && now < speakingUntil;

  function stateAt(now: number): FloorState {
    return {
      talking: talkingSince !== null,
      interviewerSpeaking: isSpeaking(now),
      interviewerPreparing: preparing !== null,
      talkMs: talkingSince !== null ? now - talkingSince : talkMs,
      silenceMs: silentSince === null ? null : now - silentSince,
      sinceBackchannelMs: lastBackchannelAt === null ? null : now - lastBackchannelAt,
      lastSaid,
      quietAfterTurnMs: turnClosedAt === null ? null : now - turnClosedAt,
      ...phases.state(now),
    };
  }

  /** Stops the interviewer mid-line if it is speaking, or drops the reply it is preparing. */
  function bargeIn(now: number): Decision {
    if (preparing) {
      preparing = null;
      return { kind: 'stop-preparing' };
    }
    if (!isSpeaking(now)) return silent;
    speakingUntil = null;
    return { kind: 'stop-speaking' };
  }

  /** The candidate carried on instead of answering a suggestion: that means "not yet". */
  function carryOn(now: number) {
    turnClosedAt = null;
    if (!phases.suggested) return;
    phases.notYet(now);
    withdrawalToAnnounce = true;
  }

  function respond(now: number): Decision {
    responseDueAt = null;
    silentSince = null; // this silence was the end of their turn, not a pause to backchannel
    if (lastSaid === 'done') {
      const next = phases.toOffer(now, 'candidate-said-done');
      if (next) return suggest(now, next, true);
    }
    if (lastSaid === 'question') return prepare({ kind: 'answer' });
    return prepare({ kind: 'ack' }, { turnAck: true });
  }

  function suggest(now: number, next: LaterPhase, afterDone = false) {
    phases.offer(next, now);
    turnClosedAt = null;
    return prepare({ kind: 'suggest-phase', next, afterDone });
  }

  function moveOn(): Decision {
    const phase = phases.accept();
    if (!phase) return silent;
    turnClosedAt = null; // a new phase starts fresh: quiet now is not "done" with it
    return prepare({ kind: 'move-on', phase });
  }

  /** The interviewer takes the floor now, and holds it quietly until the words arrive. */
  function prepare(reply: Reply, { turnAck = false } = {}): Decision {
    preparing = { reply, turnAck };
    speakingUntil = null;
    silentSince = null; // taking the floor fills the candidate's pause: there is nothing left to backchannel
    return { kind: 'preparing', reply };
  }

  /** The words arrived: the interviewer says them, holding the floor for as long as they take to say. */
  function speak(now: number, line: string): Decision {
    if (!preparing) return silent; // too late: a barge-in or the round's end already dropped this reply
    const { reply, turnAck } = preparing;
    preparing = null;
    const speakingMs = speakingTime(line);
    speakingUntil = now + speakingMs;
    speakingAck = turnAck;
    return { ...reply, line, speakingMs } as Decision;
  }

  function moveOnCue(now: number): MoveOnCue {
    return turnClosedAt !== null && now - turnClosedAt >= floorRules.doneAfterSilence ? 'quiet-after-turn' : 'none';
  }

  /** Returns the decision, and whether it is worth logging. */
  function decide(signal: Signal, now: number): [Decision, boolean] {
    if (ended) return [silent, false];
    switch (signal.type) {
      case 'round-end':
        ended = true;
        if (talkingSince !== null) talkMs = now - talkingSince; // close the talk the candidate was in
        talkingSince = null;
        speakingUntil = null;
        preparing = null;
        responseDueAt = null;
        return [silent, true];

      case 'talk-start':
        carryOn(now);
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
        if (phases.suggested && acceptPhrases.test(text)) {
          bargeIn(now);
          return [moveOn(), true];
        }
        carryOn(now);
        lastSaid = donePhrases.test(text) ? 'done' : text.endsWith('?') ? 'question' : 'statement';
        silentSince = null; // their turn is over: no backchannel for this pause
        responseDueAt = now + floorRules.respondAfter;
        return [bargeIn(now), true];
      }

      case 'phase-answer':
        if (!phases.suggested) return [silent, true];
        if (signal.accept) return [moveOn(), true];
        phases.notYet(now);
        withdrawalToAnnounce = true;
        return [prepare({ kind: 'ack' }), true];

      case 'editor-activity':
        // Coding is not silence: restart the quiet that would read as "done". It answers no suggestion.
        if (turnClosedAt !== null) turnClosedAt = now;
        return [silent, true];

      case 'words':
        return [speak(now, signal.line), true];

      case 'tick':
        return onTick(now);
    }
  }

  function onTick(now: number): [Decision, boolean] {
    if (!introduced && talkingSince === null && now - openedAt >= floorRules.introAfter) {
      introduced = true;
      return [prepare({ kind: 'intro' }), true];
    }
    if (withdrawalToAnnounce) {
      withdrawalToAnnounce = false;
      return [{ kind: 'suggestion-withdrawn' }, true];
    }
    if (speakingUntil !== null && !isSpeaking(now)) {
      speakingUntil = null;
      if (speakingAck && talkingSince === null && responseDueAt === null) turnClosedAt = now;
      return [{ kind: 'done-speaking' }, true];
    }
    if (responseDueAt !== null && talkingSince === null && now >= responseDueAt) return [respond(now), true];

    const floorIsFree = talkingSince === null && speakingUntil === null && preparing === null && responseDueAt === null;
    if (floorIsFree && phases.expired(now)) {
      phases.notYet(now); // nobody answered: same as "not yet"
      return [{ kind: 'suggestion-withdrawn' }, true];
    }
    const next = floorIsFree ? phases.toOffer(now, moveOnCue(now)) : null;
    if (next) return [suggest(now, next), true];

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

/** Roughly how long a line takes to say aloud: about 15 characters a second, at least a second. */
function speakingTime(line: string) {
  return Math.max(1_000, Math.round((line.length / 15) * 1_000));
}
