import { listenOnLoopback, readBody } from './loopback.ts';

/** An installed model as the fake reports it. */
export interface FakeOllamaModel {
  name: string;
  /** As Ollama writes it, e.g. "8.0B". */
  parameterSize: string;
  contextLength?: number;
  /** e.g. ["completion", "tools", "thinking"]. */
  capabilities?: string[];
}

/** What the fake does with the next chat request. */
export type FakeOllamaReply =
  | { text: string; chunks?: number; inputTokens?: number; outputTokens?: number }
  | { status: number; error: string }
  /** Sends the start of a reply, then waits until the request is aborted. */
  | { hang: true };

export interface RecordedOllamaRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

/**
 * A stand-in for Ollama on loopback: its native API (model list, model details, streamed chat).
 * Point the Ollama address at `origin`, so nothing leaves the machine.
 */
export async function fakeOllama(installed: FakeOllamaModel[] = []) {
  const replies: FakeOllamaReply[] = [];
  const requests: RecordedOllamaRequest[] = [];

  const server = await listenOnLoopback(async (request, response) => {
    const raw = await readBody(request);
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: request.method ?? '', path: request.url ?? '', body });
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    };

    if (request.url === '/api/tags') {
      json(200, {
        models: installed.map((m) => ({
          name: m.name,
          model: m.name,
          size: 1_000_000_000,
          details: { family: 'llama', parameter_size: m.parameterSize, quantization_level: 'Q4_K_M' },
        })),
      });
      return;
    }
    if (request.url === '/api/show') {
      const model = installed.find((m) => m.name === body.model);
      if (!model) return json(404, { error: `model '${body.model}' not found` });
      json(200, {
        details: { family: 'llama', parameter_size: model.parameterSize },
        model_info: { 'general.architecture': 'llama', 'llama.context_length': model.contextLength ?? 32768 },
        capabilities: model.capabilities ?? ['completion'],
      });
      return;
    }
    if (request.url === '/api/chat') {
      const next = replies.shift() ?? { status: 500, error: 'no reply scripted' };
      if ('status' in next) return json(next.status, { error: next.error });
      response.writeHead(200, { 'content-type': 'application/x-ndjson' });
      const line = (value: unknown) => response.write(`${JSON.stringify(value)}\n`);
      const piece = (content: string) => line({ model: body.model, message: { role: 'assistant', content }, done: false });
      if ('hang' in next) {
        piece('Well');
        return; // never finishes; the client's abort closes it
      }
      const { text, chunks = 3, inputTokens = 120, outputTokens = 12 } = next;
      const size = Math.max(1, Math.ceil(text.length / chunks));
      for (let i = 0; i < text.length; i += size) piece(text.slice(i, i + size));
      line({ model: body.model, message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: inputTokens, eval_count: outputTokens });
      response.end();
      return;
    }
    json(404, { error: 'not found' });
  });

  return {
    origin: server.origin,
    requests,
    chats: () => requests.filter((r) => r.path === '/api/chat'),
    reply: (...next: FakeOllamaReply[]) => void replies.push(...next),
    close: server.close,
  };
}

