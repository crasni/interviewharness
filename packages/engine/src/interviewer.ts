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
import { buildReplyPrompt } from './prompt.ts';
import { quotesSolution } from './solution-guard.ts';
import type { Clock, Round } from './round.ts';

/** Timing rules for the interviewer's words, in milliseconds. */
export const replyRules = {
  /** A reply that takes longer than this is given up on, and the fallback line is said instead. */
  timeout: 10_000,
  /** A cap on a reply's length, so small models stay short and in role. */
  maxOutputTokens: 200,
  /** Words beyond this are cut at the last whole sentence: an interviewer never lectures. */
  maxWords: 60,
};

/** How much help a reply gave: none, or a rung of the problem's hint ladder. */
export const hintLevels = ['none', 'nudge', 'question', 'concrete'] as const;
export type HintLevel = (typeof hintLevels)[number];
const rungs: (keyof HintLadder)[] = ['nudge', 'question', 'concrete'];

/** Why an attempt at a reply's words was thrown away and written again. */
export type Rejection = 'hint-unasked' | 'hint-skipped-rung' | 'hint-too-concrete' | 'solution-leak';

const corrections: Record<Rejection, string> = {
  'hint-unasked': "it gave a hint the candidate didn't ask for. Answer only what they asked, with no hint.",
  'hint-skipped-rung': 'it gave more help than the next rung of the hint ladder. Give only that rung.',
  'hint-too-concrete': "it gave the concrete hint when they hadn't asked for help. Give a smaller insight, or none.",
  'solution-leak': 'it quoted the reference solution. Never quote or describe its code.',
};

/**
 * What the candidate is doing with a turn, as the model hears it (ADR 0017). The reply follows from it,
 * and so does how much help may be given: a hint only when they ask for help or sound stuck.
 */
export const candidateTurns = [
  'thinking-aloud',
  'murmur',
  'clarifying-question',
  'seeking-affirmation',
  'asking-for-help',
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
} as const satisfies Record<string, TurnReplyKind>;
type TurnKindName = keyof typeof turnKinds;

/**
 * A reply to the candidate's turn, structured so code can act on what the model understood: what the
 * candidate was doing, what kind of reply fits, how much help it gives (checked before it's said), and
 * the phase the conversation is really in.
 */
interface TurnWords {
  heard: CandidateTurn;
  kind: TurnKindName;
  words: string;
  hintLevel: HintLevel;
  phase: CodingPhase;
}

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.includes(value as T);

const turnSchema: ObjectSchema<TurnWords> = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: {
      heard: { type: 'string', enum: [...candidateTurns], description: 'What the candidate is doing with this turn.' },
      kind: { type: 'string', enum: Object.keys(turnKinds), description: 'The kind of reply that fits.' },
      words: { type: 'string', description: 'What you say aloud; empty if you stay quiet.' },
      hintLevel: { type: 'string', enum: [...hintLevels], description: 'The rung of the hint ladder your words give, or none.' },
      phase: {
        type: 'string',
        enum: [...CODING_PHASES],
        description: "The phase the conversation is in now, by what the candidate is actually doing: it may be ahead of the round's.",
      },
    },
    required: ['heard', 'kind', 'words', 'hintLevel', 'phase'],
    additionalProperties: false,
  },
  parse(value) {
    const { heard, kind, words, hintLevel, phase } = (value ?? {}) as Record<string, unknown>;
    if (
      !oneOf(candidateTurns, heard) ||
      !oneOf(Object.keys(turnKinds) as TurnKindName[], kind) ||
      typeof words !== 'string' ||
      !oneOf(hintLevels, hintLevel) ||
      !oneOf(CODING_PHASES, phase)
    ) {
      throw new Error(
        `Expected heard (${candidateTurns.join(', ')}), kind (${Object.keys(turnKinds).join(', ')}), words (a string), hintLevel (${hintLevels.join(', ')}) and phase (${CODING_PHASES.join(', ')})`,
      );
    }
    return { heard, kind, words, hintLevel, phase };
  },
};

/** A check-in comes back structured too, so the help in it can be checked like any other. */
const checkInSchema: ObjectSchema<{ words: string; hintLevel: HintLevel }> = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: {
      words: { type: 'string', description: 'What you say aloud.' },
      hintLevel: { type: 'string', enum: [...hintLevels], description: 'The rung of the hint ladder your words give, or none.' },
    },
    required: ['words', 'hintLevel'],
    additionalProperties: false,
  },
  parse(value) {
    const { words, hintLevel } = (value ?? {}) as Record<string, unknown>;
    if (typeof words !== 'string' || !oneOf(hintLevels, hintLevel)) {
      throw new Error(`Expected words (a string) and hintLevel (${hintLevels.join(', ')})`);
    }
    return { words, hintLevel };
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
    /** For a reply to the candidate: the phase it heard the conversation in. The round follows it forward. */
    phase?: CodingPhase;
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

/** The example-lines situation whose line is said when the model can't give the words for a reply. */
export function fallbackSituation(reply: Reply): Situation {
  switch (reply.kind) {
    case 'turn':
      return 'acknowledgement';
    case 'intro':
      return reply.kind;
    case 'check-in':
      return 'check-in';
  }
}

interface Call {
  id: number;
  reply: Reply;
  startedAt: number;
  controller: AbortController;
}

/**
 * The interviewer: the Floor Manager decides whether and when to speak, and what kind of reply to give;
 * the model writes the words. Backchannels never wait on the model.
 */
export function createInterviewer(options: InterviewerOptions) {
  const { clock, round, lines, log, model, onEvent } = options;
  const floor = createFloorManager({ clock, round, lines, log });
  const transcript: RecordLine[] = [];
  const phases: RoundRecord['phases'] = [{ phase: round.snapshot().phase, atMs: 0 }];
  const hints: RoundRecord['hints'] = [];
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
    onEvent(decision);
    if (decision.kind === 'preparing') requestWords(decision.reply);
  }

  function say(line: string, as?: TurnReplyKind) {
    handle(floor.onSignal({ type: 'words', line, ...(as ? { as } : {}) }));
  }

  function fallBack(reply: Reply, error: ModelErrorKind) {
    onEvent({ kind: 'model-failed', error });
    say(lines.next(fallbackSituation(reply)));
  }

  /** The rung the interviewer may give next if asked, or null when all three are given. */
  const nextHint = () => rungs[hintsGiven] ?? null;

  /** One attempt at a reply's words. An answer comes back structured, with the help it gave. */
  async function attempt(call: Call, correction: string | undefined) {
    const { phase, phaseElapsedMs } = round.snapshot();
    const prompt = buildReplyPrompt({
      reply: call.reply,
      phase,
      phaseElapsedMs,
      problem: options.problem,
      toneGuide: options.toneGuide,
      transcript,
      code,
      nextHint: nextHint(),
      correction,
    });
    const request = { purpose: 'interviewer-reply' as const, ...prompt, signal: call.controller.signal, maxOutputTokens: replyRules.maxOutputTokens };
    if (call.reply.kind === 'turn') {
      const { object, usage } = await model!.generateObject({ ...request, schema: turnSchema });
      const askedForHelp = object.heard === 'asking-for-help';
      return {
        words: object.words.trim(),
        usage,
        heard: object.heard,
        kind: object.kind,
        phase: object.phase,
        hint: { askedForHelp, level: object.hintLevel },
        // Help comes only when asked for, or, a little at a time, when they're stuck: never the answer.
        mayHint: askedForHelp ? 'any' : object.heard === 'stuck' ? 'small' : 'none',
      } as const;
    }
    if (call.reply.kind === 'check-in') {
      const { object, usage } = await model!.generateObject({ ...request, schema: checkInSchema });
      // The first check-in in a silence only checks in; later ones may offer a small insight if they're stuck.
      const mayHint = call.reply.nth > 1 ? 'small' : 'none';
      return { words: object.words.trim(), usage, hint: { askedForHelp: false, level: object.hintLevel }, mayHint } as const;
    }
    const { text, usage } = await model!.streamText(request);
    return { words: text.trim(), usage, mayHint: 'none' } as const;
  }

  /**
   * What's wrong with an attempt's words, if anything: help that wasn't asked for (or, when they're stuck,
   * more than a small insight), help that skips a rung, or a leak of the solution.
   */
  function rejection(written: Awaited<ReturnType<typeof attempt>>): Rejection | null {
    const level = 'hint' in written && written.hint ? written.hint.level : 'none';
    if (level !== 'none') {
      if (written.mayHint === 'none') return 'hint-unasked';
      if (written.mayHint === 'small' && level === 'concrete') return 'hint-too-concrete';
      const allowed = Math.max(1, rungs.indexOf(nextHint() ?? 'concrete') + 1);
      if (hintLevels.indexOf(level) > allowed) return 'hint-skipped-rung';
    }
    return quotesSolution(written.words, options.problem.reference.code) ? 'solution-leak' : null;
  }

  /** Writes a reply's words: a rejected attempt is written once more, and then given up for the fallback line. */
  async function compose(call: Call) {
    const rejected: Rejection[] = [];
    for (let tries = 0; tries < 2; tries++) {
      // A barge-in or the time limit may have ended this reply while the last attempt was checked.
      if (call.controller.signal.aborted) throw new ModelError('aborted');
      const written = await attempt(call, rejected.length ? corrections[rejected.at(-1)!] : undefined);
      const staysQuiet = 'kind' in written && written.kind === 'stay-quiet';
      if (!written.words && !staysQuiet) throw new ModelError('bad-output', 'The reply was empty');
      const problem = rejection(written);
      if (!problem) return { written: { ...written, words: capped(written.words) }, rejected };
      rejected.push(problem);
    }
    return { written: null, rejected };
  }

  function requestWords(reply: Reply) {
    abandon('aborted'); // a newer reply replaces one still being prepared
    if (!model) return say(lines.next(fallbackSituation(reply)));

    const call: Call = { id: ++calls, reply, startedAt: clock.now(), controller: new AbortController() };
    pending = call;
    compose(call).then(
      ({ written, rejected }) => {
        if (pending !== call) return logCall(call, 'late-reply-dropped', { usage: written?.usage });
        pending = null;
        const extra = rejected.length ? { rejected } : {};
        if (!written) {
          logCall(call, 'replaced', extra);
          return say(lines.next(fallbackSituation(reply)));
        }
        if (written.hint && written.hint.level !== 'none') {
          hints.push(written.hint.level);
          hintsGiven = Math.max(hintsGiven, rungs.indexOf(written.hint.level) + 1);
        }
        logCall(call, 'spoken', {
          usage: written.usage,
          ...('heard' in written && written.heard ? { heard: written.heard } : {}),
          ...('kind' in written && written.kind ? { turnReply: written.kind } : {}),
          ...(written.hint ? { hint: written.hint } : {}),
          ...(written.phase ? { phase: written.phase } : {}),
          ...extra,
        });
        // The round follows the conversation forward (never back), as the interviewer heard it; first, so an
        // offer the candidate just accepted, or one for the phase after, starts from where they really are.
        if (written.phase && written.phase !== 'clarify') handle(floor.onSignal({ type: 'phase-reached', phase: written.phase }));
        say(written.words, written.kind && turnKinds[written.kind]);
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
      if (signal.type === 'round-end') abandon('aborted');
      handle(floor.onSignal(signal));
      if (signal.type === 'tick' && pending && clock.now() - pending.startedAt >= replyRules.timeout) {
        const { reply } = pending;
        abandon('failed', 'timeout');
        fallBack(reply, 'timeout');
      }
    },

    /** What the round leaves for grading. */
    record(): RoundRecord {
      return { elapsedMs: round.snapshot().elapsedMs, transcript: [...transcript], phases: [...phases], hints: [...hints], code };
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
