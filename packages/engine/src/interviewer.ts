import { createFloorManager, type Decision, type FloorLogEntry, type Reply, type Signal } from './floor-manager.ts';
import type { LineBook, Situation } from './lines.ts';
import { type Model, type ModelErrorKind, type ModelIdentity, type ModelUsage, modelErrorKind } from './model.ts';
import type { Problem } from './problem.ts';
import { buildReplyPrompt, type TranscriptLine } from './prompt.ts';
import type { Clock, Round } from './round.ts';

/** Timing rules for the interviewer's words, in milliseconds. */
export const replyRules = {
  /** A reply that takes longer than this is given up on, and the fallback line is said instead. */
  timeout: 10_000,
  /** A cap on a reply's length, so small models stay short and in role. */
  maxOutputTokens: 200,
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
     * aborted: a barge-in, a newer reply or the round's end made it pointless. late-reply-dropped: words
     * arrived after the call was already aborted or timed out, and were thrown away.
     */
    outcome: 'spoken' | 'failed' | 'aborted' | 'late-reply-dropped';
    error?: ModelErrorKind;
    usage?: ModelUsage;
  };
}

/** Everything the round's log records: the Floor Manager's decisions and the model calls behind its words. */
export type RoundLogEntry = FloorLogEntry | ModelCallEntry;

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
  const transcript: TranscriptLine[] = [];
  // The call whose words the interviewer is waiting on. Any other call that finishes is too late.
  let pending: Call | null = null;
  let calls = 0;

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
    if ('speakingMs' in decision) {
      transcript.push({ who: 'interviewer', text: decision.line, atMs: round.snapshot().elapsedMs });
    }
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

  function requestWords(reply: Reply) {
    abandon('aborted'); // a newer reply replaces one still being prepared
    if (!model) return say(lines.next(fallbackSituation(reply)));

    const call: Call = { id: ++calls, reply, startedAt: clock.now(), controller: new AbortController() };
    pending = call;
    const { phase, phaseElapsedMs } = round.snapshot();
    const prompt = buildReplyPrompt({ reply, phase, phaseElapsedMs, problem: options.problem, toneGuide: options.toneGuide, transcript });
    model
      .streamText({
        purpose: 'interviewer-reply',
        ...prompt,
        signal: call.controller.signal,
        maxOutputTokens: replyRules.maxOutputTokens,
      })
      .then(
        ({ text, usage }) => {
          const words = text.trim();
          if (pending !== call) return logCall(call, 'late-reply-dropped', { usage });
          pending = null;
          if (!words) {
            logCall(call, 'failed', { error: 'bad-output', usage });
            return fallBack(reply, 'bad-output');
          }
          logCall(call, 'spoken', { usage });
          say(words);
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
        transcript.push({ who: 'candidate', text: signal.text.trim(), atMs: round.snapshot().elapsedMs });
      }
      if (signal.type === 'round-end') abandon('aborted');
      handle(floor.onSignal(signal));
      if (signal.type === 'tick' && pending && clock.now() - pending.startedAt >= replyRules.timeout) {
        const { reply } = pending;
        abandon('failed', 'timeout');
        fallBack(reply, 'timeout');
      }
    },
  };
}

export type Interviewer = ReturnType<typeof createInterviewer>;
