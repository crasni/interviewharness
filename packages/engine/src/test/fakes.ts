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
`);
}

/**
 * One scripted reply:
 * - words, said at once (or after `delayMs` of real time);
 * - an error of a given kind;
 * - 'wait': nothing until the test answers it through `waiting` (it ignores abort, like a model that
 *   answers late, so tests can check a late reply is dropped).
 */
export type ScriptedReply = string | { text: string; delayMs?: number } | { error: ModelErrorKind } | 'wait';

export type ModelScript = Partial<Record<ModelPurpose, ScriptedReply[]>>;

interface Waiting {
  request: ModelRequest;
  answer(text: string): void;
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

  const model: Model = {
    identity: { provider: 'scripted', model: 'scripted-fake' },

    async streamText(request, onText) {
      requests.push(request);
      const next = queues.get(request.purpose)?.shift();
      if (next === undefined) throw new ModelError('other', `The script has no ${request.purpose} reply left`);
      if (next === 'wait') {
        return new Promise((resolve, reject) => {
          waiting.push({
            request,
            answer: (text) => resolve({ text, usage }),
            fail: (kind) => reject(new ModelError(kind)),
          });
        });
      }
      if (typeof next === 'object' && 'error' in next) throw new ModelError(next.error);
      const { text, delayMs = 0 } = typeof next === 'string' ? { text: next } : next;
      if (delayMs) await abortableDelay(delayMs, request.signal);
      onText?.(text);
      return { text, usage };
    },

    async generateObject(request) {
      requests.push(request);
      throw new ModelError('other', 'The scripted model has no structured replies yet');
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
