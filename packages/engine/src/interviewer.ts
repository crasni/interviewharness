import { CODING_PHASES, type CodingPhase } from '@interviewharness/core';
import {
  type CodeSnapshot,
  createFloorManager,
  type Decision,
  type FloorLogEntry,
  type Reply,
  type Signal,
  type TurnReplyKind,
} from './floor-manager.ts';
import type { LineBook, Situation } from './lines.ts';
import {
  type Model,
  ModelError,
  type ModelErrorKind,
  type ModelIdentity,
  type ModelUsage,
  modelErrorKind,
  type ObjectSchema,
} from './model.ts';
import type { HintLadder, Problem } from './problem.ts';
import type { GradingEntry, RecordLine, RoundRecord } from './grading.ts';
import { buildCheckPrompt, buildReplyPrompt, type RoundSoFar } from './prompt.ts';
import { quotesSolution } from './solution-guard.ts';
import { type Clock, codingRoundMs, type LaterPhase, nextPhase, type Round } from './round.ts';

/** Timing rules for the interviewer's words, in milliseconds. */
export const replyRules = {
  /** A reply that takes longer than this is given up on, and the fallback line is said instead. */
  timeout: 10_000,
  /** A cap on a reply's length, so small models stay short and in role (the words, and what the model observed). */
  maxOutputTokens: 300,
  /** Words beyond this are cut at the last whole sentence: an interviewer never lectures. */
  maxWords: 60,
  /** A cap on the check's answer: three short fields. */
  checkMaxOutputTokens: 100,
};

/** How much help a reply gave: none, or a rung of the problem's hint ladder. */
export const hintLevels = ['none', 'nudge', 'question', 'concrete'] as const;
export type HintLevel = (typeof hintLevels)[number];
const rungs: (keyof HintLadder)[] = ['nudge', 'question', 'concrete'];

/** Why an attempt at a reply's words was thrown away and written again. */
export type Rejection = 'hint-unasked' | 'mistake-unasked' | 'hint-skipped-rung' | 'offer-unasked' | 'step-unasked' | 'solution-leak';

const corrections: Record<Rejection, string> = {
  'hint-unasked': "it gave a hint the candidate didn't ask for. Answer only what they asked, with no hint.",
  'mistake-unasked': "it said what or where their mistake is, which they didn't ask for. Don't point at it: it's theirs to find.",
  'hint-skipped-rung': 'it gave more help than the next rung of the hint ladder. Give only that rung.',
  'offer-unasked':
    "it offered help too soon. Offer help only when they say they're stuck or after repeated failed attempts, and not again once they've declined it.",
  'step-unasked': 'it told them what to try next. Ask at most one neutral question, such as what feels blocked, and leave the next step to them.',
  'solution-leak': 'it gave away part of the solution. Never quote or describe the solution, its code or its steps.',
};

/**
 * The turns where help could slip into a reply (ADR 0019): its words get the check before they're said.
 * Also any reply that labels itself as help, and help asked for by accepting an offer of it.
 */
const riskyTurns: readonly CandidateTurn[] = ['done', 'asking-for-help', 'stuck', 'seeking-affirmation'];

/** The check's verdict on a reply's words, judged apart from writing them: what they give the candidate. */
export interface CheckVerdict {
  namesMistake: boolean;
  hintLevel: HintLevel;
  describesSolution: boolean;
}

const checkSchema: ObjectSchema<CheckVerdict> = {
  name: 'verdict',
  jsonSchema: {
    type: 'object',
    properties: {
      namesMistake: { type: 'boolean', description: "Whether the words say what or where a mistake in the candidate's code or approach is." },
      hintLevel: { type: 'string', enum: [...hintLevels], description: 'How much of the hint ladder the words give, or none.' },
      describesSolution: { type: 'boolean', description: "Whether the words describe steps or ideas of the solution the candidate hasn't said themselves." },
    },
    required: ['namesMistake', 'hintLevel', 'describesSolution'],
    additionalProperties: false,
  },
  parse(value) {
    const { namesMistake, hintLevel, describesSolution } = (value ?? {}) as Record<string, unknown>;
    if (typeof namesMistake !== 'boolean' || !oneOf(hintLevels, hintLevel) || typeof describesSolution !== 'boolean') {
      throw new Error(`Expected namesMistake and describesSolution (true or false) and hintLevel (${hintLevels.join(', ')})`);
    }
    return { namesMistake, hintLevel, describesSolution };
  },
};

/**
 * What the candidate is doing with a turn, as the model hears it (ADR 0017). The reply follows from it,
 * and so does how much help may be given: a hint only when they ask for help or accept an offer of it.
 */
export const candidateTurns = [
  'thinking-aloud',
  'murmur',
  'clarifying-question',
  'seeking-affirmation',
  'asking-for-help',
  'asking-to-move-on',
  'stuck',
  'explaining',
  'done',
  'answering-interviewer',
  'agreeing',
  'declining',
  'small-talk',
] as const;
export type CandidateTurn = (typeof candidateTurns)[number];

/** How the model labels its reply to a turn, in the words its schema uses. */
const turnKinds = {
  answer: 'answer',
  acknowledgement: 'ack',
  'offer-next-phase': 'offer',
  backchannel: 'backchannel',
  'stay-quiet': 'quiet',
  goodbye: 'ack',
} as const satisfies Record<string, TurnReplyKind>;
type TurnKindName = keyof typeof turnKinds;

/**
 * What the interviewer's words ask the candidate to do, so the round knows who started a test or a follow-up.
 * Also the one neutral question to a stuck candidate (what-blocks), and an offer of help.
 */
export const interviewerAsks = ['nothing', 'trace-example', 'edge-case', 'complexity', 'follow-up', 'what-blocks', 'offer-help', 'other'] as const;
export type InterviewerAsk = (typeof interviewerAsks)[number];

/** Where the candidate's own words take the round: another phase, ahead or back, or nowhere. */
type Move = 'stays' | CodingPhase;
const moves: readonly Move[] = ['stays', ...CODING_PHASES];

/**
 * A reply to the candidate's turn, structured so code can keep the round's state (ADR 0018). First what the
 * model observed about the turn, then its reply and what that reply does: the help it gives and what it asks.
 * The model only reports; the app moves phases, counts help and records tests from these fields.
 */
interface TurnWords {
  heard: CandidateTurn;
  movesTo: Move;
  checkedCode: boolean;
  foundOwnMistake: boolean;
  saysCodeDone: boolean;
  attemptFailed: boolean;
  kind: TurnKindName;
  words: string;
  hintLevel: HintLevel;
  pointsOutMistake: boolean;
  asks: InterviewerAsk;
}

/** What the model observed about a turn, and what its reply does: the app keeps the round's books from these. */
type Observed = Pick<TurnWords, 'movesTo' | 'checkedCode' | 'foundOwnMistake' | 'saysCodeDone' | 'attemptFailed' | 'pointsOutMistake' | 'asks'>;

/** One attempt at a reply's words, with what the model says they do and, once checked, the check's verdict. */
interface Written {
  words: string;
  usage: ModelUsage;
  /** For a reply to a turn: what the candidate was doing, the reply's kind and what the model observed. */
  heard?: CandidateTurn;
  kind?: TurnKindName;
  observed?: Observed;
  /** Whether the candidate asked for help. Absent for the intro, which never helps, so logs no hint. */
  askedForHelp?: boolean;
  /**
   * What the words give the candidate, for every kind of reply: the model's own labels, then the check's verdict
   * once checked. A rejection reads only this, so a turn and the intro are judged alike.
   */
  gives: { hintLevel: HintLevel; namesMistake: boolean };
  /** Whether this reply may help: only when the candidate asked for help or accepted an offer of it. */
  mayHint: boolean;
  check?: CheckVerdict;
}

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.includes(value as T);

const turnSchema: ObjectSchema<TurnWords> = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: {
      heard: { type: 'string', enum: [...candidateTurns], description: 'What the candidate is doing with this turn.' },
      movesTo: {
        type: 'string',
        enum: [...moves],
        description: 'The phase the candidate moved to, or asked to move to, with this turn, ahead or back (saying yes to your offer counts; going back to fix their code after testing counts); "stays" otherwise. Only their own words count, never your questions.',
      },
      checkedCode: {
        type: 'boolean',
        description: 'Whether the candidate checked their code in this turn: walked an input through it, gave test cases with what it returns, or said what it does on an edge case.',
      },
      foundOwnMistake: { type: 'boolean', description: 'Whether the candidate spotted a mistake in their own code or approach in this turn, without you pointing it out.' },
      saysCodeDone: {
        type: 'boolean',
        description: 'Whether the candidate says in this turn that their code is finished, ready to be judged as it is. Finishing an explanation, an approach or a test run does not count; nor does asking for help with code they are still working on.',
      },
      attemptFailed: { type: 'boolean', description: "Whether the candidate says something they tried didn't work: a trace or a run gave the wrong result, or an idea fell through." },
      kind: { type: 'string', enum: Object.keys(turnKinds), description: 'The kind of reply that fits.' },
      words: { type: 'string', description: 'What you say aloud; empty if you stay quiet.' },
      hintLevel: { type: 'string', enum: [...hintLevels], description: 'The rung of the hint ladder your words give, or none.' },
      pointsOutMistake: { type: 'boolean', description: 'Whether your words say what or where a mistake in their code or approach is.' },
      asks: { type: 'string', enum: [...interviewerAsks], description: 'What your words ask the candidate to do.' },
    },
    required: ['heard', 'movesTo', 'checkedCode', 'foundOwnMistake', 'saysCodeDone', 'attemptFailed', 'kind', 'words', 'hintLevel', 'pointsOutMistake', 'asks'],
    additionalProperties: false,
  },
  parse(value) {
    const { heard, movesTo, checkedCode, foundOwnMistake, saysCodeDone, attemptFailed, kind, words, hintLevel, pointsOutMistake, asks } = (value ?? {}) as Record<string, unknown>;
    if (
      !oneOf(candidateTurns, heard) ||
      !oneOf(moves, movesTo) ||
      typeof checkedCode !== 'boolean' ||
      typeof foundOwnMistake !== 'boolean' ||
      typeof saysCodeDone !== 'boolean' ||
      typeof attemptFailed !== 'boolean' ||
      !oneOf(Object.keys(turnKinds) as TurnKindName[], kind) ||
      typeof words !== 'string' ||
      !oneOf(hintLevels, hintLevel) ||
      typeof pointsOutMistake !== 'boolean' ||
      !oneOf(interviewerAsks, asks)
    ) {
      throw new Error(
        `Expected heard (${candidateTurns.join(', ')}), movesTo (${moves.join(', ')}), checkedCode, foundOwnMistake, saysCodeDone and attemptFailed (true or false), kind (${Object.keys(turnKinds).join(', ')}), words (a string), hintLevel (${hintLevels.join(', ')}), pointsOutMistake (true or false) and asks (${interviewerAsks.join(', ')})`,
      );
    }
    return { heard, movesTo, checkedCode, foundOwnMistake, saysCodeDone, attemptFailed, kind, words, hintLevel, pointsOutMistake, asks };
  },
};

/** One model call, logged once its fate is known. Never holds a key, a token or a prompt. */
export interface ModelCallEntry {
  at: number;
  modelCall: {
    id: number;
    purpose: 'interviewer-reply';
    reply: Reply['kind'];
    model: ModelIdentity;
    /** Time from the request to its fate. */
    ms: number;
    /**
     * spoken: its words were said. failed: an error or the time limit; the fallback line was said.
     * replaced: every attempt was rejected (see `rejected`), so the fallback line was said.
     * aborted: a barge-in, a newer reply or the round's end made it pointless. late-reply-dropped: words
     * arrived after the call was already aborted or timed out, and were thrown away.
     */
    outcome: 'spoken' | 'failed' | 'replaced' | 'aborted' | 'late-reply-dropped';
    error?: ModelErrorKind;
    usage?: ModelUsage;
    /** For a reply to a turn: what the model heard the candidate doing, and the kind of reply it chose. */
    heard?: CandidateTurn;
    turnReply?: TurnKindName;
    /** Whether the candidate asked for help, and the hint rung given. Grading reads this. */
    hint?: { askedForHelp: boolean; level: HintLevel };
    /** Attempts thrown away before the words were said (or replaced), and why. */
    rejected?: Rejection[];
    /**
     * For a reply to a turn: what the model observed and what its words do, which the app keeps the round's state from.
     * Also on a reply that was replaced or cut off after its first attempt: what was observed about the turn still counts.
     */
    observed?: Observed;
    /** The check's verdict on the words that were said, when they were checked. It overrides the reply's own labels. */
    check?: CheckVerdict;
  };
}

/** Everything the round's log records: the Floor Manager's decisions and the model calls behind its words. */
export type RoundLogEntry = FloorLogEntry | ModelCallEntry | GradingEntry;

export interface RoundLog {
  write(entry: RoundLogEntry): void;
}

/** What the room is told: every decision worth showing, and a notice when the model let the interviewer down. */
export type InterviewerEvent =
  | Exclude<Decision, { kind: 'silent' }>
  | { kind: 'model-failed'; error: ModelErrorKind };

export interface InterviewerOptions {
  clock: Clock;
  round: Round;
  lines: LineBook;
  log: RoundLog;
  /** Writes the interviewer's words. With none, the example lines are said as written, as in v0.0. */
  model: Model | null;
  /** The round's problem: what the candidate sees, and the notes, hints and solution only the interviewer sees. */
  problem: Problem;
  /** The example-lines file, given to the model as guidance for tone and length. */
  toneGuide: string;
  onEvent: (event: InterviewerEvent) => void;
}

/** The example-lines situation whose line is said when every attempt at a reply was rejected: for a turn, a safe line that helps with nothing. */
export function replacedSituation(reply: Reply): Situation {
  return reply.kind === 'turn' ? 'walk-through' : fallbackSituation(reply);
}

/** What an example line said in place of the model's words asks the candidate to do: the walk-through line asks for a trace. */
function fallbackAsks(situation: Situation): InterviewerAsk {
  return situation === 'walk-through' ? 'trace-example' : 'nothing';
}

/** The example-lines situation whose line is said when the model can't give the words for a reply. */
export function fallbackSituation(reply: Reply): Situation {
  switch (reply.kind) {
    case 'turn':
      return 'acknowledgement';
    case 'intro':
      return reply.kind;
    case 'check-in':
      return 'check-in';
    case 'time-reminder':
      return 'time-reminder';
    case 'closing':
      return 'wrap-up';
  }
}

/** Replies said as reviewed lines from the example lines, never written by the model: nothing it could add is called for. */
function reviewedOnly(reply: Reply) {
  return reply.kind === 'check-in' || reply.kind === 'time-reminder' || reply.kind === 'closing';
}

interface Call {
  id: number;
  reply: Reply;
  startedAt: number;
  /** When the model call now running began: the reply, then its check, each get the time limit. */
  stepAt: number;
  controller: AbortController;
  /** The candidate's line it replies to, if any. */
  about: string | null;
  /** What the first attempt observed about that line, applied to the round once, whatever becomes of the words. */
  observed?: Observed;
}

/** When the interviewer may offer help without the candidate saying they're stuck. */
export const helpRules = {
  /** Attempts the candidate said failed, since the last hint, before an offer of help is allowed. */
  failedAttemptsBeforeOffer: 2,
};

/** When the round may still turn to the follow-up questions. */
export const followUpRules = {
  /** Time a follow-up needs: with less left in the round, it goes straight to Wrap-up. */
  minTimeLeft: 5 * 60_000,
};

/**
 * The interviewer: the Floor Manager decides whether and when to speak, and what kind of reply to give;
 * the model writes the words. Backchannels never wait on the model.
 */
export function createInterviewer(options: InterviewerOptions) {
  const { clock, round, lines, log, model, onEvent } = options;
  const followUpsOpen = () =>
    asked.filter((a) => a.asks === 'follow-up').length < options.problem.followUps.length &&
    round.timeLeftMs() >= followUpRules.minTimeLeft;
  const skipsPhase = (phase: LaterPhase) => phase === 'follow-up' && !followUpsOpen();
  // Declined help stops check-ins too, until the candidate gets back to work or asks again. After goodbye,
  // neither silence nor the clock gets another word.
  const floor = createFloorManager({
    clock,
    round,
    lines,
    log,
    skipsPhase,
    checksIn: () => !declinedHelp && !saidGoodbye,
    keepsTime: () => !saidGoodbye,
  });
  // The round's books (ADR 0018): kept here from what the model reports, never left to the model to remember.
  const transcript: RecordLine[] = [];
  const phases: RoundRecord['phases'] = [{ phase: round.snapshot().phase, atMs: 0 }];
  const hints: RoundRecord['hints'] = [];
  const checks: RoundRecord['checks'] = [];
  const mistakes: RoundRecord['mistakes'] = [];
  const codeDone: RoundRecord['codeDone'] = [];
  const asked: RoundRecord['asked'] = [];
  // The phase offered and not yet answered; what the interviewer's last spoken reply asked, and whether it named a mistake.
  let offered: LaterPhase | null = null;
  let lastAsk: InterviewerAsk = 'nothing';
  let lastPointedOut = false;
  let saidGoodbye = false;
  // Help around an impasse: whether the interviewer asked what's blocking them, whether the candidate declined
  // its offer of help, and the attempts they said failed since the last hint.
  let askedWhatBlocks = false;
  let declinedHelp = false;
  let failedAttempts = 0;
  const line = (who: RecordLine['who'], text: string) =>
    transcript.push({ id: `t${transcript.length + 1}`, who, text, atMs: round.snapshot().elapsedMs });
  // The call whose words the interviewer is waiting on. Any other call that finishes is too late.
  let pending: Call | null = null;
  let calls = 0;
  let code: CodeSnapshot | null = null;
  // How many rungs of the hint ladder the candidate has been given, so the next is never skipped.
  let hintsGiven = 0;

  function logCall(call: Call, outcome: ModelCallEntry['modelCall']['outcome'], extra: Partial<ModelCallEntry['modelCall']> = {}) {
    const now = clock.now();
    log.write({
      at: now,
      modelCall: {
        id: call.id,
        purpose: 'interviewer-reply',
        reply: call.reply.kind,
        model: model!.identity,
        ms: now - call.startedAt,
        outcome,
        ...(call.observed ? { observed: call.observed } : {}),
        ...extra,
      },
    });
  }

  /** Gives up on the pending call, if any; whatever it returns later is dropped. */
  function abandon(outcome: 'aborted' | 'failed', error?: ModelErrorKind) {
    const call = pending;
    if (!call) return;
    pending = null;
    call.controller.abort();
    logCall(call, outcome, error ? { error } : {});
  }

  function handle(decision: Decision) {
    if (decision.kind === 'silent') return;
    if (decision.kind === 'stop-preparing') abandon('aborted');
    if ('speakingMs' in decision) line('interviewer', decision.line);
    if (decision.kind === 'phase-moved') phases.push({ phase: decision.phase, atMs: round.snapshot().elapsedMs });
    if (decision.kind === 'suggest-phase') offered = decision.next;
    if (decision.kind === 'suggestion-withdrawn' || decision.kind === 'phase-moved') offered = null;
    onEvent(decision);
    if (decision.kind === 'preparing') requestWords(decision.reply);
  }

  function say(line: string, as?: TurnReplyKind) {
    handle(floor.onSignal({ type: 'words', line, ...(as ? { as } : {}) }));
  }

  /** Says an example line in place of the model's words, and keeps the books for what it asks, as for any reply. */
  function sayFallback(situation: Situation, minutesLeft?: number) {
    const words = minutesLeft === undefined ? lines.next(situation) : lines.next(situation).replaceAll('{minutes}', String(minutesLeft));
    say(words);
    noteSaid(words, undefined, { asks: fallbackAsks(situation), pointsOutMistake: false });
  }

  function fallBack(reply: Reply, error: ModelErrorKind) {
    onEvent({ kind: 'model-failed', error });
    sayFallback(fallbackSituation(reply));
  }

  /** The rung the interviewer may give next if asked, or null when all three are given. */
  const nextHint = () => rungs[hintsGiven] ?? null;

  /** The round so far, as the model is told it every time. */
  function soFar(): RoundSoFar {
    const { phase, elapsedMs } = round.snapshot();
    let next = nextPhase(phase);
    while (next && skipsPhase(next)) next = nextPhase(next);
    return {
      elapsedMs,
      roundMs: codingRoundMs,
      phases,
      offered,
      nextPhase: next,
      hints,
      nextHint: nextHint(),
      mistakesPointedOut: mistakes.filter((m) => m.foundBy === 'interviewer').length,
      checks: { own: checks.filter((t) => t.by === 'candidate').length, asked: checks.filter((t) => t.by === 'interviewer').length },
      followUps: { asked: asked.filter((a) => a.asks === 'follow-up').length, open: followUpsOpen() },
      help: { askedWhatBlocks, offer: declinedHelp ? 'declined' : lastAsk === 'offer-help' ? 'waiting' : 'none', failedAttempts },
      saidGoodbye,
    };
  }

  /** One attempt at a reply's words. An answer comes back structured, with the help it gave. */
  async function attempt(call: Call, correction: string | undefined): Promise<Written> {
    const { phase, phaseElapsedMs } = round.snapshot();
    const prompt = buildReplyPrompt({
      reply: call.reply,
      phase,
      phaseElapsedMs,
      problem: options.problem,
      toneGuide: options.toneGuide,
      transcript,
      code,
      soFar: soFar(),
      correction,
    });
    const request = { purpose: 'interviewer-reply' as const, ...prompt, signal: call.controller.signal, maxOutputTokens: replyRules.maxOutputTokens };
    call.stepAt = clock.now();
    if (call.reply.kind === 'turn') {
      const { object, usage } = await model!.generateObject({ ...request, schema: turnSchema });
      const { heard, movesTo, checkedCode, foundOwnMistake, saysCodeDone, attemptFailed, pointsOutMistake, asks } = object;
      // Help comes only when asked for: in so many words, or by accepting the interviewer's offer.
      const askedForHelp = heard === 'asking-for-help' || (heard === 'agreeing' && lastAsk === 'offer-help');
      return {
        words: object.words.trim(),
        usage,
        heard,
        kind: object.kind,
        observed: { movesTo, checkedCode, foundOwnMistake, saysCodeDone, attemptFailed, pointsOutMistake, asks },
        askedForHelp,
        gives: { hintLevel: object.hintLevel, namesMistake: pointsOutMistake },
        mayHint: askedForHelp,
      };
    }
    const { text, usage } = await model!.streamText(request);
    return { words: text.trim(), usage, gives: { hintLevel: 'none', namesMistake: false }, mayHint: false };
  }

  /** Whether help could have slipped into an attempt's words, so they get the check before they're said. */
  function risky(call: Call, written: Written) {
    if (!written.words || call.reply.kind === 'intro') return false;
    if (written.gives.hintLevel !== 'none' || written.gives.namesMistake || written.askedForHelp) return true;
    return written.heard !== undefined && riskyTurns.includes(written.heard);
  }

  /**
   * The check (ADR 0019): the same model, asked apart from writing the words, what they give the candidate.
   * Its verdict replaces the attempt's own labels, which a model judging its own words gets wrong when it matters.
   */
  async function checked(call: Call, written: Written): Promise<Written> {
    if (!risky(call, written)) return written;
    call.stepAt = clock.now();
    const prompt = buildCheckPrompt({ problem: options.problem, transcript, code, words: written.words });
    const { object: check, usage } = await model!.generateObject({
      purpose: 'reply-check',
      ...prompt,
      schema: checkSchema,
      signal: call.controller.signal,
      maxOutputTokens: replyRules.checkMaxOutputTokens,
    });
    const both = { inputTokens: written.usage.inputTokens + usage.inputTokens, outputTokens: written.usage.outputTokens + usage.outputTokens };
    const gives = { hintLevel: check.hintLevel, namesMistake: check.namesMistake };
    const observed = written.observed && { ...written.observed, pointsOutMistake: check.namesMistake };
    return { ...written, usage: both, gives, ...(observed ? { observed } : {}), check };
  }

  /**
   * What's wrong with an attempt's words, if anything: help that wasn't asked for, a mistake named unasked, help
   * that skips a rung, an offer of help too soon, a step prescribed to a stuck candidate, or a leak of the solution.
   */
  function rejection(written: Written): Rejection | null {
    // Naming the mistake takes the finding of it away from the candidate: it's help, so only when asked for.
    if (written.gives.namesMistake && !written.mayHint) return 'mistake-unasked';
    const level = written.gives.hintLevel;
    if (level !== 'none') {
      if (!written.mayHint) return 'hint-unasked';
      const allowed = Math.max(1, rungs.indexOf(nextHint() ?? 'concrete') + 1);
      if (hintLevels.indexOf(level) > allowed) return 'hint-skipped-rung';
    }
    const asks = written.observed?.asks;
    if (asks === 'offer-help' && !mayOffer(written.heard)) return 'offer-unasked';
    // A stuck candidate gets one neutral question, not a case to try or a step to take: those are theirs to find.
    if (written.heard === 'stuck' && !written.mayHint && (asks === 'trace-example' || asks === 'edge-case' || asks === 'complexity')) {
      return 'step-unasked';
    }
    if (written.check?.describesSolution) return 'solution-leak';
    return quotesSolution(written.words, options.problem.reference.code) ? 'solution-leak' : null;
  }

  /**
   * Whether a reply may offer help: the candidate said they're stuck, or said attempts failed again and again,
   * and hasn't declined help since. Read after the turn is noted, so this turn's failed attempt counts once.
   */
  function mayOffer(heard: CandidateTurn | undefined) {
    return !declinedHelp && (heard === 'stuck' || failedAttempts >= helpRules.failedAttemptsBeforeOffer);
  }

  /** Writes a reply's words, checked where help could slip: a rejected attempt is written once more, then given up for a safe line. */
  async function compose(call: Call) {
    const rejected: Rejection[] = [];
    for (let tries = 0; tries < 2; tries++) {
      // A barge-in or the time limit may have ended this reply while the last attempt was checked.
      if (call.controller.signal.aborted) throw new ModelError('aborted');
      const first = await attempt(call, rejected.length ? corrections[rejected.at(-1)!] : undefined);
      noteTurn(call, first.heard, first.observed);
      const staysQuiet = first.kind === 'stay-quiet';
      if (!first.words && !staysQuiet) throw new ModelError('bad-output', 'The reply was empty');
      // Labels the reply gives itself already rule it out: no need to wait on the check.
      const written = rejection(first) ? first : await checked(call, first);
      const problem = rejection(written);
      if (!problem) return { written: { ...written, words: capped(written.words) }, rejected };
      rejected.push(problem);
    }
    return { written: null, rejected };
  }

  /**
   * Keeps the books for the candidate's turn, from what the model's first reading of it observed: each time they
   * checked their code and who started it, mistakes and how they were found, when they said their code was done,
   * attempts they said failed, help they declined, and the phase their own words moved the round to. This is what the candidate did, so it stays whether or not the reply's words are ever said;
   * applied once per turn, so a rewritten reply can't count it again. The move comes before the words, so an
   * accepted offer is settled first.
   */
  function noteTurn(call: Call, heard: CandidateTurn | undefined, observed: Observed | undefined) {
    // A reply already replaced (a barge-in, a newer turn, the time limit) has no say; nor has a second reading.
    if (!observed || call.observed || pending !== call) return;
    call.observed = observed;
    const { about } = call;
    const asked = lastAsk === 'trace-example' || lastAsk === 'edge-case';
    if (observed.attemptFailed) failedAttempts += 1;
    if (heard === 'declining' && lastAsk === 'offer-help') declinedHelp = true;
    if (heard === 'stuck' || heard === 'asking-for-help') declinedHelp = false;
    if (about && observed.checkedCode) checks.push({ lineId: about, by: asked ? 'interviewer' : 'candidate' });
    if (about && observed.saysCodeDone) codeDone.push(about);
    if (about && observed.foundOwnMistake && !lastPointedOut) mistakes.push({ lineId: about, foundBy: asked ? 'candidate-when-asked' : 'candidate' });
    if (observed.movesTo !== 'stays') moveTo(observed.movesTo);
  }

  /** Moves the round to a phase, unless it's the follow-ups and they're no longer open. */
  function moveTo(phase: CodingPhase) {
    if (phase === 'follow-up' && !followUpsOpen()) return;
    handle(floor.onSignal({ type: 'phase-reached', phase }));
  }

  /** Keeps the books for what the interviewer just said: what it asked, a mistake it named, a goodbye. */
  function noteSaid(words: string, kind: TurnKindName | undefined, observed: Pick<Observed, 'asks' | 'pointsOutMistake'> | undefined) {
    const said = transcript.at(-1);
    if (!said || said.who !== 'interviewer' || said.text !== words) return; // quiet, a backchannel, or dropped
    lastAsk = observed?.asks ?? 'nothing';
    lastPointedOut = observed?.pointsOutMistake ?? false;
    if (observed && observed.asks !== 'nothing') asked.push({ lineId: said.id, asks: observed.asks });
    if (observed?.asks === 'what-blocks') askedWhatBlocks = true;
    if (observed?.pointsOutMistake) mistakes.push({ lineId: said.id, foundBy: 'interviewer' });
    if (kind === 'goodbye') saidGoodbye = true;
  }

  function requestWords(reply: Reply) {
    abandon('aborted'); // a newer reply replaces one still being prepared
    // At time, the closing line turns the round to Wrap-up, as the start of the follow-ups turns it to Follow-up.
    if (reply.kind === 'closing') moveTo('wrap-up');
    // A check-in, a time reminder and the closing are reviewed lines, never generated: silence or the clock
    // alone is no reason to say more than that.
    if (!model || reviewedOnly(reply)) return sayFallback(fallbackSituation(reply), reply.kind === 'time-reminder' ? reply.minutesLeft : undefined);

    const about = reply.kind === 'turn' ? (transcript.findLast((l) => l.who === 'candidate')?.id ?? null) : null;
    const call: Call = { id: ++calls, reply, startedAt: clock.now(), stepAt: clock.now(), controller: new AbortController(), about };
    pending = call;
    compose(call).then(
      ({ written, rejected }) => {
        if (pending !== call) return logCall(call, 'late-reply-dropped', { usage: written?.usage });
        pending = null;
        const extra = rejected.length ? { rejected } : {};
        if (!written) {
          logCall(call, 'replaced', extra);
          return sayFallback(replacedSituation(reply));
        }
        const level = written.gives.hintLevel;
        if (level !== 'none') {
          hints.push(level);
          hintsGiven = Math.max(hintsGiven, rungs.indexOf(level) + 1);
          // Help reached them: a new impasse starts from here.
          askedWhatBlocks = false;
          failedAttempts = 0;
        }
        logCall(call, 'spoken', {
          usage: written.usage,
          ...(written.heard ? { heard: written.heard } : {}),
          ...(written.kind ? { turnReply: written.kind } : {}),
          ...(written.askedForHelp !== undefined ? { hint: { askedForHelp: written.askedForHelp, level } } : {}),
          ...(written.observed ? { observed: written.observed } : {}),
          ...(written.check ? { check: written.check } : {}),
          ...extra,
        });
        const { observed, kind } = written;
        // Besides the candidate's own words, the round moves when the interviewer begins the follow-ups; never on its other questions.
        if (observed?.asks === 'follow-up' && call.observed?.movesTo === 'stays') moveTo('follow-up');
        // After the goodbye only a real question gets an answer: thanks or bye doesn't reopen the round.
        if (saidGoodbye && (kind === 'goodbye' || written.heard !== 'clarifying-question')) return say('', 'quiet');
        say(written.words, kind && turnKinds[kind]);
        noteSaid(written.words, kind, observed);
      },
      (error: unknown) => {
        if (pending !== call) return; // aborted or timed out already, and logged then
        pending = null;
        const kind = modelErrorKind(error);
        logCall(call, 'failed', { error: kind });
        fallBack(reply, kind);
      },
    );
  }

  return {
    onSignal(signal: Signal) {
      if (signal.type === 'said' && signal.text.trim()) {
        line('candidate', signal.text.trim());
        if (signal.code) code = signal.code;
      }
      if (signal.type === 'round-end' && signal.code) code = signal.code;
      // Getting back to work after declining help is a change: a later silence may get check-ins again.
      if (signal.type === 'editor-activity') declinedHelp = false;
      if (signal.type === 'round-end') abandon('aborted');
      handle(floor.onSignal(signal));
      if (signal.type === 'tick' && pending && clock.now() - pending.stepAt >= replyRules.timeout) {
        const { reply } = pending;
        abandon('failed', 'timeout');
        fallBack(reply, 'timeout');
      }
    },

    /** What the round leaves for grading. */
    record(): RoundRecord {
      return {
        elapsedMs: round.snapshot().elapsedMs,
        transcript: [...transcript],
        phases: [...phases],
        hints: [...hints],
        checks: [...checks],
        mistakes: [...mistakes],
        codeDone: [...codeDone],
        asked: [...asked],
        code,
      };
    },
  };
}

export type Interviewer = ReturnType<typeof createInterviewer>;

/** A reply cut to at most `replyRules.maxWords`, at the end of a sentence where there is one. */
function capped(words: string) {
  const all = words.split(/\s+/);
  if (all.length <= replyRules.maxWords) return words;
  const kept = all.slice(0, replyRules.maxWords).join(' ');
  const sentenceEnd = Math.max(kept.lastIndexOf('. '), kept.lastIndexOf('? '), kept.lastIndexOf('! '), /[.?!]$/.test(kept) ? kept.length - 1 : -1);
  return sentenceEnd > 0 ? kept.slice(0, sentenceEnd + 1) : kept;
}
