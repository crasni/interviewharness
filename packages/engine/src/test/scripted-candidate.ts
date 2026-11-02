import {
  type CodeSnapshot,
  createInterviewer,
  type InterviewerEvent,
  type LineBook,
  type Model,
  type ModelCallEntry,
  type ModelIdentity,
  type Problem,
  type RoundLogEntry,
  type RoundRecord,
  sayingItAgainHelps,
  startRound,
} from '../index.ts';

/**
 * One thing a scripted candidate does:
 * - `say`: ends their turn with these words (as typed in the room), with `code` as the editor now holds it;
 * - `silentFor`: says and types nothing for this long;
 * - `typeFor`: types in the editor for this long, leaving `code` there at the end.
 */
export type CandidateStep = { say: string; code?: string } | { silentFor: number } | { typeFor: number; code?: string };

/** A candidate whose every move is written in advance, to play through a whole round. */
export interface ScriptedCandidate {
  /** A short name, used for the transcript's file name. */
  name: string;
  /** What kind of candidate this is, and what to watch the interviewer do with them. */
  about: string;
  /** The editor's language. Python unless said. */
  language?: string;
  steps: CandidateStep[];
}

export interface PlayedRound {
  candidate: ScriptedCandidate;
  model: ModelIdentity;
  record: RoundRecord;
  /** The round's log: the Floor Manager's decisions and the model calls, as the app writes to events.jsonl. */
  log: RoundLogEntry[];
  /** What the room was told, with the round time it was told. */
  events: { atMs: number; event: InterviewerEvent }[];
}

export interface PlayOptions {
  candidate: ScriptedCandidate;
  model: Model;
  problem: Problem;
  lines: LineBook;
  toneGuide: string;
  /**
   * Waits this long in real time. Used only while the interviewer waits on the model, so its time limit
   * is real; the rest of the round (silences, typing) runs in round time, as fast as it can.
   */
  wait?: (ms: number) => Promise<void>;
}

const tickEvery = 100;
/** Typing sends editor activity about once a second, as the app does. */
const typingEvery = 1_000;
/** After the candidate's turn: time for the interviewer to start replying. */
const replyBeat = 1_000;
/** The most round time to wait for the interviewer to finish a reply, so a stuck round still ends. */
const replyLimit = 60_000;

const realWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Kinds of decision that end a reply being prepared: its words were said, or dropped. */
const replyEnds = new Set<InterviewerEvent['kind']>(['ack', 'answer', 'intro', 'suggest-phase', 'check-in', 'time-reminder', 'closing', 'quiet', 'backchannel', 'stop-preparing']);
/** Kinds of decision that put the interviewer mid-line. */
const speaks = new Set<InterviewerEvent['kind']>(['ack', 'answer', 'intro', 'suggest-phase', 'check-in', 'time-reminder', 'closing']);

/**
 * Plays a scripted candidate through a whole round, through the public Interviewer, ticking ten times a
 * second as the app does. Round time is a clock of its own: it runs ahead freely while nobody waits on
 * the model, and keeps pace with real time while the interviewer does.
 */
export async function playCandidate({ candidate, model, problem, lines, toneGuide, wait = realWait }: PlayOptions): Promise<PlayedRound> {
  let now = 0;
  const clock = { now: () => now };
  const log: RoundLogEntry[] = [];
  const events: PlayedRound['events'] = [];
  let preparing = false;
  let speaking = false;
  const interviewer = createInterviewer({
    clock,
    round: startRound('coding', clock),
    lines,
    log: { write: (entry) => void log.push(entry) },
    model,
    problem,
    toneGuide,
    onEvent(event) {
      events.push({ atMs: now, event });
      if (event.kind === 'preparing') preparing = true;
      if (replyEnds.has(event.kind)) preparing = false;
      if (speaks.has(event.kind)) speaking = true;
      if (event.kind === 'done-speaking' || event.kind === 'stop-speaking') speaking = false;
    },
  });

  const language = candidate.language ?? 'python';
  let code: CodeSnapshot | undefined;

  async function tick() {
    // Lets the model's words arrive between ticks, as they would from the network.
    await (preparing ? wait(tickEvery) : wait(0));
    now += tickEvery;
    interviewer.onSignal({ type: 'tick' });
  }

  async function run(ms: number, typing = false) {
    for (let elapsed = 0; elapsed < ms; elapsed += tickEvery) {
      if (typing && elapsed % typingEvery === 0) interviewer.onSignal({ type: 'editor-activity' });
      await tick();
    }
  }

  /** Waits until the interviewer has finished whatever it started: preparing a reply, and saying it. */
  async function settle() {
    await run(replyBeat);
    for (let waited = 0; (preparing || speaking) && waited < replyLimit; waited += tickEvery) await tick();
  }

  await settle(); // the intro
  for (const step of candidate.steps) {
    if ('say' in step) {
      if (step.code !== undefined) code = { language, text: step.code };
      interviewer.onSignal({ type: 'said', text: step.say, ...(code ? { code } : {}) });
    } else if ('silentFor' in step) {
      await run(step.silentFor);
    } else {
      await run(step.typeFor, true);
      if (step.code !== undefined) code = { language, text: step.code };
    }
    await settle();
  }
  interviewer.onSignal({ type: 'round-end', ...(code ? { code } : {}) });

  return { candidate, model: model.identity, record: interviewer.record(), log, events };
}

/** A played round as text to read: who and which model, then each line with its round time, and notes on the model calls behind them. */
export { checkRound, type ReplyTimes, replyTimes, type RoundFailure } from './round-checks.ts';

export function formatPlayedRound({ candidate, model, record, log }: PlayedRound): string {
  const out = [`# ${candidate.name}`, '', candidate.about, '', `Model: ${model.provider} / ${model.model}`, `Round time: ${clockTime(record.elapsedMs)}`, ''];
  for (const entry of log) {
    if ('modelCall' in entry) {
      out.push(`       [${modelCallNote(entry.modelCall)}]`);
      // A failed reply to their turn says nothing; the room's notice is what they got.
      const { outcome, reply, error } = entry.modelCall;
      if (outcome === 'failed' && reply === 'turn') {
        out.push(`       [nothing said; the room told the candidate the model failed${error && sayingItAgainHelps(error) ? ' and to say it again' : ''}]`);
      }
      continue;
    }
    if (!('signal' in entry)) continue;
    const { at, signal, decision } = entry;
    if (signal.type === 'said' && signal.text.trim()) out.push(`${clockTime(at)}  Candidate: ${signal.text.trim()}`);
    if ('line' in decision) {
      const who = decision.kind === 'backchannel' ? 'Interviewer (backchannel)' : 'Interviewer';
      out.push(`${clockTime(at)}  ${who}: ${decision.line}`);
    }
  }
  out.push('', '## Round record', '', '```json', JSON.stringify({ ...record, transcript: undefined }, null, 2), '```', '');
  return out.join('\n');
}

function modelCallNote(call: ModelCallEntry['modelCall']) {
  const parts = [`${call.reply} reply ${call.outcome} in ${(call.ms / 1000).toFixed(1)} s`];
  if (call.during === 'check') parts.push('the check failed');
  const given = [call.heard && `heard ${call.heard}`, call.turnReply, call.hint && `hint ${call.hint.level}`].filter(Boolean);
  if (given.length) parts.push(given.join(', '));
  if (call.observed && call.observed.asks !== 'nothing') parts.push(`asks ${call.observed.asks}`);
  if (call.observed?.movesTo && call.observed.movesTo !== 'stays') parts.push(`moves to ${call.observed.movesTo}`);
  if (call.rejected?.length) parts.push(`rejected: ${call.rejected.join(', ')}`);
  if (call.error) parts.push(`error: ${call.error}`);
  if (call.reason) parts.push(`reason: ${call.reason}`);
  return parts.join('; ');
}

/** Round time as mm:ss. */
function clockTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
