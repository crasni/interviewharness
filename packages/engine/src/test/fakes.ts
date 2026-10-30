import {
  createLineBook,
  type Model,
  ModelError,
  type ModelErrorKind,
  type ModelPurpose,
  type ModelRequest,
  type RoundLogEntry,
} from '../index.ts';

export function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

export function fakeLog<Entry = RoundLogEntry>() {
  const entries: Entry[] = [];
  return { entries, write: (entry: Entry) => void entries.push(entry) };
}

export function testLines() {
  return createLineBook(`
## Backchannel
- Mm-hm.
- Okay.

## Acknowledgement
- Okay, that makes sense.

## Answer
- Good question. You can assume the input fits in memory.

## Intro
- Hi, thanks for joining. Let's start with the problem.

## Suggest approach
- Want to talk through your approach?

## Suggest code
- Want to start coding?

## Suggest test
- Want to test it?

## Suggest complexity
- Want to talk about complexity?

## Suggest wrap-up
- Shall we wrap up?

## Move on
- Sounds good.

## Wrap-up
- That's about time. Do you have any questions for me?

## Check-in
- Want to talk me through where you are?
`);
}

/**
 * One scripted reply:
 * - words, said at once (or after `delayMs` of real time);
 * - `{ object }`, a structured reply (checked against the request's schema, like a real model's);
 * - an error of a given kind;
 * - 'wait': nothing until the test answers it through `waiting` (it ignores abort, like a model that
 *   answers late, so tests can check a late reply is dropped).
 */
export type ScriptedReply =
  | string
  | { text: string; delayMs?: number }
  | { object: unknown; delayMs?: number }
  | { error: ModelErrorKind }
  | 'wait';

export type ModelScript = Partial<Record<ModelPurpose, ScriptedReply[]>>;

interface Waiting {
  request: ModelRequest;
  /** Words for a text request, or the object for a structured one. */
  answer(reply: unknown): void;
  fail(kind: ModelErrorKind): void;
}

/**
 * A model that gives scripted replies per purpose, in order, and records every request it got.
 * Runs out loudly: a request with no reply left fails, so a test never passes on a reply it didn't script.
 */
export function scriptedModel(script: ModelScript = {}) {
  const queues = new Map(Object.entries(script).map(([purpose, replies]) => [purpose, [...replies]]));
  const requests: ModelRequest[] = [];
  const waiting: Waiting[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  /** The next scripted reply for a request: words or an object, once any delay has passed. */
  async function next(request: ModelRequest, kind: 'text' | 'object'): Promise<unknown> {
    requests.push(request);
    const reply = queues.get(request.purpose)?.shift();
    if (reply === undefined) throw new ModelError('other', `The script has no ${request.purpose} reply left`);
    if (reply === 'wait') {
      return new Promise((resolve, reject) => {
        waiting.push({ request, answer: resolve, fail: (error) => reject(new ModelError(error)) });
      });
    }
    if (typeof reply === 'object' && 'error' in reply) throw new ModelError(reply.error);
    const scripted = typeof reply === 'string' ? { text: reply } : reply;
    if (scripted.delayMs) await abortableDelay(scripted.delayMs, request.signal);
    if (kind === 'text' && 'text' in scripted) return scripted.text;
    if (kind === 'object' && 'object' in scripted) return scripted.object;
    throw new ModelError('bad-output', `The script has ${'text' in scripted ? 'words' : 'an object'} where ${kind === 'text' ? 'words' : 'an object'} were asked for`);
  }

  const model: Model = {
    identity: { provider: 'scripted', model: 'scripted-fake' },

    async streamText(request, onText) {
      const text = String(await next(request, 'text'));
      onText?.(text);
      return { text, usage };
    },

    async generateObject(request) {
      const object = await next(request, 'object');
      try {
        return { object: request.schema.parse(object), usage };
      } catch (error) {
        throw new ModelError('bad-output', String(error));
      }
    },
  };

  return { ...model, model, requests, waiting };
}

function abortableDelay(ms: number, signal: AbortSignal | undefined) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new ModelError('aborted'));
    });
  });
}
