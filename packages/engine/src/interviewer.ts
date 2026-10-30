import { CODING_PHASES, type CodingPhase } from '@interviewharness/core';
import {
  type CodeSnapshot,
  createFloorManager,
  type Decision,
  type FloorLogEntry,
  type Reply,
  type Signal,
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
export type Rejection = 'hint-unasked' | 'hint-skipped-rung' | 'solution-leak';

const corrections: Record<Rejection, string> = {
  'hint-unasked': "it gave a hint the candidate didn't ask for. Answer only what they asked, with no hint.",
  'hint-skipped-rung': 'it gave more help than the next rung of the hint ladder. Give only that rung.',
  'solution-leak': 'it quoted the reference solution. Never quote or describe its code.',
};

/** A reply to something the candidate said: its words, and the phase the conversation is really in now. */
interface TurnWords {
  words: string;
  phase: CodingPhase;
}

/** An answer also says how much help it gave, so code can check it before it's said. */
interface AnswerWords extends TurnWords {
  askedForHelp: boolean;
  hintLevel: HintLevel;
}

const phaseProperty = {
  type: 'string',
  enum: [...CODING_PHASES],
  description: "The phase the conversation is in now, by what the candidate is actually doing: it may be ahead of the round's.",
};

function parseTurn(value: unknown): TurnWords {
  const { words, phase } = (value ?? {}) as Record<string, unknown>;
  if (typeof words !== 'string' || !CODING_PHASES.includes(phase as CodingPhase)) {
    throw new Error(`Expected words (a string) and phase (one of ${CODING_PHASES.join(', ')})`);
  }
  return { words, phase: phase as CodingPhase };
}

/** An acknowledgement comes back structured, so the round can follow the conversation's phase. */
const ackSchema: ObjectSchema<TurnWords> = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: { words: { type: 'string', description: 'What you say aloud.' }, phase: phaseProperty },
    required: ['words', 'phase'],
    additionalProperties: false,
  },
  parse: parseTurn,
};

const answerSchema: ObjectSchema<AnswerWords> = {
  name: 'say',
  jsonSchema: {
    type: 'object',
    properties: {
      words: { type: 'string', description: 'What you say aloud.' },
      askedForHelp: { type: 'boolean', description: 'Whether the candidate asked for help, a hint or what to do next.' },
      hintLevel: { type: 'string', enum: [...hintLevels], description: 'The rung of the hint ladder your words give, or none.' },
      phase: phaseProperty,
    },
    required: ['words', 'askedForHelp', 'hintLevel', 'phase'],
    additionalProperties: false,
  },
  parse(value) {
    const turn = parseTurn(value);
    const { askedForHelp, hintLevel } = (value ?? {}) as Record<string, unknown>;
    if (typeof askedForHelp !== 'boolean' || !hintLevels.includes(hintLevel as HintLevel)) {
      throw new Error('Expected askedForHelp (true or false) and hintLevel (none, nudge, question or concrete)');
    }
    return { ...turn, askedForHelp, hintLevel: hintLevel as HintLevel };
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
    /** For an answer: whether the candidate asked for help, and the hint rung given. Grading reads this. */
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
    case 'ack':
      return 'acknowledgement';
    case 'answer':
    case 'intro':
      return reply.kind;
    case 'suggest-phase':
      return `suggest-${reply.next}`;
    case 'move-on':
      return reply.phase === 'wrap-up' ? 'wrap-up' : 'move-on';
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
    if (decision.kind === 'preparing' && decision.reply.kind === 'move-on') {
      phases.push({ phase: decision.reply.phase, atMs: round.snapshot().elapsedMs });
    }
    if (decision.kind === 'phase-moved') phases.push({ phase: decision.phase, atMs: round.snapshot().elapsedMs });
    onEvent(decision);
    if (decision.kind === 'preparing') requestWords(decision.reply);
  }

  function say(line: string) {
    handle(floor.onSignal({ type: 'words', line }));
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
    if (call.reply.kind === 'answer') {
      const { object, usage } = await model!.generateObject({ ...request, schema: answerSchema });
      return { words: object.words.trim(), usage, phase: object.phase, hint: { askedForHelp: object.askedForHelp, level: object.hintLevel } };
    }
    if (call.reply.kind === 'ack') {
      const { object, usage } = await model!.generateObject({ ...request, schema: ackSchema });
      return { words: object.words.trim(), usage, phase: object.phase };
    }
    const { text, usage } = await model!.streamText(request);
    return { words: text.trim(), usage };
  }

  /** What's wrong with an attempt's words, if anything: help that wasn't asked for or skips a rung, or a leak. */
  function rejection({ words, hint }: Awaited<ReturnType<typeof attempt>>): Rejection | null {
    if (hint && hint.level !== 'none') {
      if (!hint.askedForHelp) return 'hint-unasked';
      const allowed = Math.max(1, rungs.indexOf(nextHint() ?? 'concrete') + 1);
      if (hintLevels.indexOf(hint.level) > allowed) return 'hint-skipped-rung';
    }
    return quotesSolution(words, options.problem.reference.code) ? 'solution-leak' : null;
  }

  /** Writes a reply's words: a rejected attempt is written once more, and then given up for the fallback line. */
  async function compose(call: Call) {
    const rejected: Rejection[] = [];
    for (let tries = 0; tries < 2; tries++) {
      // A barge-in or the time limit may have ended this reply while the last attempt was checked.
      if (call.controller.signal.aborted) throw new ModelError('aborted');
      const written = await attempt(call, rejected.length ? corrections[rejected.at(-1)!] : undefined);
      if (!written.words) throw new ModelError('bad-output', 'The reply was empty');
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
          ...(written.hint ? { hint: written.hint } : {}),
          ...(written.phase ? { phase: written.phase } : {}),
          ...extra,
        });
        say(written.words);
        // The round follows the conversation forward (never back), as the interviewer heard it.
        if (written.phase && written.phase !== 'clarify') handle(floor.onSignal({ type: 'phase-reached', phase: written.phase }));
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
