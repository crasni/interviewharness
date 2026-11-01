import { type Model, ModelError, type ModelRequest, type ModelUsage } from '@interviewharness/engine';
import type { ModelChoice, ModelListing } from './providers.ts';

export { defaultOllamaAddress } from './defaults.ts';

/** Parses Ollama's parameter size ("8.0B", "270M") into a count. Unknown sizes are NaN. */
function parameterCount(size: string | undefined) {
  const match = /^([\d.]+)\s*([KMBT])?$/i.exec(size?.trim() ?? '');
  if (!match) return Number.NaN;
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(match[2] ?? '').toUpperCase() as 'K' | 'M' | 'B' | 'T'] ?? 1;
  return Number(match[1]) * scale;
}

interface Tags {
  models?: { name: string; details?: { parameter_size?: string } }[];
}

/**
 * One request to Ollama's native API. Nothing listening fails as offline; an error reply fails with
 * Ollama's own message, which names the model or the problem.
 */
async function call(address: string, path: string, fetchFn: typeof fetch, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetchFn(new URL(path, address), init);
  } catch {
    if (init.signal?.aborted) throw new ModelError('aborted');
    throw new ModelError('offline', `Ollama isn't running at ${address}`);
  }
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ModelError('other', error ?? `Ollama answered ${response.status}`);
  }
  return response;
}

/** What a model can do (chat, think, embed) and how much context it takes, from Ollama's model details. */
async function details(address: string, model: string, fetchFn: typeof fetch, signal?: AbortSignal) {
  const response = await call(address, '/api/show', fetchFn, { method: 'POST', body: JSON.stringify({ model }), signal });
  const { capabilities = ['completion'], model_info = {} } = (await response.json()) as Details;
  const limit = Object.entries(model_info).find(([key]) => key.endsWith('.context_length'))?.[1];
  return { chats: capabilities.includes('completion'), thinks: capabilities.includes('thinking'), contextLimit: typeof limit === 'number' ? limit : minimumContext };
}

/** The models installed in Ollama at `address` that can chat (not those that only embed). */
export async function ollamaModels(address: string, fetchFn: typeof fetch, smallBelow: number): Promise<ModelListing[]> {
  const response = await call(address, '/api/tags', fetchFn);
  const { models = [] } = (await response.json()) as Tags;
  const listed = await Promise.all(
    models.map(async (model) => {
      if (!(await details(address, model.name, fetchFn)).chats) return [];
      const parameters = parameterCount(model.details?.parameter_size);
      return [{ id: model.name, name: model.name, local: true, small: parameters < smallBelow }];
    }),
  );
  return listed.flat();
}

interface Details {
  capabilities?: string[];
  model_info?: Record<string, unknown>;
}

/** One line of a streamed chat reply. */
interface ChatLine {
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

/** The smallest context the interviewer asks for: a round's prompt (rules, problem, solution, transcript, code) runs to several thousand tokens. */
const minimumContext = 8192;

/**
 * The context size for a request: room for the prompt and the reply, in powers of two so it rarely
 * changes (Ollama reloads the model when it does), and never beyond what the model supports.
 */
function contextSize(request: ModelRequest, modelLimit: number) {
  const characters = request.system.length + request.messages.reduce((sum, m) => sum + m.text.length, 0);
  // About three characters a token for English and code, on the generous side.
  const needed = Math.ceil(characters / 3) + (request.maxOutputTokens ?? 1024) + 256;
  let size = minimumContext;
  while (size < needed) size *= 2;
  return Math.min(size, modelLimit);
}

/** A model in Ollama, through its native chat API (not its OpenAI-compatible one, which can't set the context size or turn thinking off). */
export function ollamaModel(address: () => string, fetchFn: typeof fetch, choice: ModelChoice): Model {
  let known: ReturnType<typeof details> | undefined;

  /** What the model can do and how much context it takes, asked once. A failed or aborted ask is asked again next time. */
  function modelDetails(signal?: AbortSignal) {
    known ??= details(address(), choice.model, fetchFn, signal).catch((error: unknown) => {
      known = undefined;
      throw error;
    });
    return known;
  }

  /** One chat request, streamed to its end. Resolves with the whole text; fails with a typed error. */
  async function chat(request: ModelRequest, extra: { format?: unknown }, onText?: (delta: string) => void) {
    const { thinks, contextLimit } = await modelDetails(request.signal);
    const body = {
      model: choice.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages.map((m) => ({ role: m.role, content: m.text }))],
      stream: true,
      ...(thinks ? { think: false } : {}),
      ...extra,
      options: {
        num_ctx: contextSize(request, contextLimit),
        ...(request.maxOutputTokens ? { num_predict: request.maxOutputTokens } : {}),
      },
    };
    const response = await call(address(), '/api/chat', fetchFn, { method: 'POST', body: JSON.stringify(body), signal: request.signal });
    let text = '';
    try {
      for await (const line of lines(response)) {
        const event = JSON.parse(line) as ChatLine;
        if (event.error) throw new ModelError('other', event.error);
        const piece = event.message?.content ?? '';
        if (piece) {
          text += piece;
          onText?.(piece);
        }
        if (event.done) {
          const usage: ModelUsage = { inputTokens: event.prompt_eval_count ?? 0, outputTokens: event.eval_count ?? 0 };
          return { text, usage };
        }
      }
    } catch (error) {
      if (request.signal?.aborted) throw new ModelError('aborted');
      if (error instanceof ModelError) throw error;
      throw new ModelError('offline', String(error));
    }
    if (request.signal?.aborted) throw new ModelError('aborted');
    throw new ModelError('bad-output', 'The reply ended without finishing');
  }

  return {
    identity: { provider: choice.provider, model: choice.model },

    streamText: (request, onText) => chat(request, {}, onText),

    /**
     * Ollama constrains the output to a JSON schema itself, which small models follow far better than a
     * forced tool call. The value is still checked; on a mismatch the model is told what was wrong and asked once more.
     */
    async generateObject(request) {
      const { schema } = request;
      const messages = [...request.messages];
      for (let tries = 0; ; tries++) {
        const { text, usage } = await chat({ ...request, messages }, { format: schema.jsonSchema });
        try {
          return { object: schema.parse(JSON.parse(text)), usage };
        } catch (error) {
          if (tries === 1) throw new ModelError('bad-output', String(error));
          messages.push({ role: 'assistant', text }, { role: 'user', text: `That reply didn't fit: ${String(error)}. Reply again.` });
        }
      }
    },
  };
}

/** The lines of a streamed body, as they arrive. */
async function* lines(response: Response) {
  const decoder = new TextDecoder();
  let buffered = '';
  for await (const chunk of response.body ?? []) {
    buffered += decoder.decode(chunk as Uint8Array, { stream: true });
    let end: number;
    while ((end = buffered.indexOf('\n')) >= 0) {
      const line = buffered.slice(0, end).trim();
      buffered = buffered.slice(end + 1);
      if (line) yield line;
    }
  }
  if (buffered.trim()) yield buffered.trim();
}
