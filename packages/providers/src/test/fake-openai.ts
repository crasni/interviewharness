import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// Kept before any test stubs the global fetch, which pi-ai's login calls directly.
const realFetch = globalThis.fetch;

/** What the fake server does with the next Responses request. */
export type FakeResponse =
  | { text: string; chunks?: number; inputTokens?: number; outputTokens?: number }
  | { status: number; body: string }
  /** A reply that calls a tool (how a structured reply arrives), with these arguments. */
  | { toolCall: { name: string; arguments: unknown } }
  /** Sends the start of a reply, then waits until the request is aborted. */
  | { hang: true };

export interface RecordedRequest {
  path: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
}

/**
 * A stand-in for OpenAI on loopback: the Responses API (streamed), and the OAuth token endpoint.
 * Tests point pi-ai's requests here with `fetchVia`, so nothing leaves the machine.
 */
export async function fakeOpenAI() {
  const responses: FakeResponse[] = [];
  const tokenResponses: { status: number; body: unknown }[] = [];
  const requests: RecordedRequest[] = [];

  const server = createServer(async (request, response) => {
    const raw = await readBody(request);
    const body = request.headers['content-type']?.includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    requests.push({ path: request.url ?? '', headers: request.headers, body });
    if (request.url?.endsWith('/oauth/token')) {
      const next = tokenResponses.shift() ?? { status: 500, body: { error: 'no token response scripted' } };
      response.writeHead(next.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(next.body));
      return;
    }
    const next = responses.shift();
    if (!next) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'no response scripted' } }));
      return;
    }
    if ('status' in next) {
      response.writeHead(next.status, { 'content-type': 'application/json' });
      response.end(next.body);
      return;
    }
    if ('toolCall' in next) streamToolCall(response, next.toolCall);
    else streamReply(response, next);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    origin,
    requests,
    reply: (...next: FakeResponse[]) => void responses.push(...next),
    replyToToken: (status: number, body: unknown) => void tokenResponses.push({ status, body }),
    /** A fetch that sends requests meant for OpenAI's servers to this one instead. */
    fetchVia: ((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      return realFetch(`${origin}${url.pathname}${url.search}`, input instanceof Request ? new Request(input, init) : init);
    }) as typeof fetch,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
  });
}

function streamToolCall(response: ServerResponse, call: { name: string; arguments: unknown }) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  let sequence = 0;
  const send = (type: string, data: Record<string, unknown>) =>
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: sequence++, ...data })}\n\n`);
  const args = JSON.stringify(call.arguments);
  const item = { id: 'fc_1', type: 'function_call', call_id: 'call_1', name: call.name, arguments: '', status: 'in_progress' };
  const done = { ...item, arguments: args, status: 'completed' };
  send('response.created', { response: { id: 'resp_1', object: 'response', status: 'in_progress', model: 'gpt-test', output: [] } });
  send('response.output_item.added', { output_index: 0, item });
  send('response.function_call_arguments.delta', { item_id: 'fc_1', output_index: 0, delta: args });
  send('response.function_call_arguments.done', { item_id: 'fc_1', output_index: 0, arguments: args });
  send('response.output_item.done', { output_index: 0, item: done });
  send('response.completed', {
    response: {
      id: 'resp_1',
      object: 'response',
      status: 'completed',
      model: 'gpt-test',
      output: [done],
      usage: { input_tokens: 150, output_tokens: 20, total_tokens: 170, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
    },
  });
  response.end();
}

function streamReply(response: ServerResponse, reply: Exclude<FakeResponse, { status: number } | { toolCall: unknown }>) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  let sequence = 0;
  const send = (type: string, data: Record<string, unknown>) =>
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: sequence++, ...data })}\n\n`);
  const responseObject = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 'resp_1',
    object: 'response',
    status,
    model: 'gpt-test',
    output: [],
    ...extra,
  });
  const item = { id: 'msg_1', type: 'message', role: 'assistant', status: 'in_progress', content: [] };

  send('response.created', { response: responseObject('in_progress') });
  send('response.output_item.added', { output_index: 0, item });
  send('response.content_part.added', { item_id: 'msg_1', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } });
  if ('hang' in reply) {
    send('response.output_text.delta', { item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'Well' });
    return; // never finishes; the client's abort closes it
  }

  const { text, chunks = 3, inputTokens = 120, outputTokens = 12 } = reply;
  const size = Math.ceil(text.length / chunks);
  for (let i = 0; i < text.length; i += size) {
    send('response.output_text.delta', { item_id: 'msg_1', output_index: 0, content_index: 0, delta: text.slice(i, i + size) });
  }
  const part = { type: 'output_text', text, annotations: [] };
  send('response.output_text.done', { item_id: 'msg_1', output_index: 0, content_index: 0, text });
  send('response.content_part.done', { item_id: 'msg_1', output_index: 0, content_index: 0, part });
  const done = { ...item, status: 'completed', content: [part] };
  send('response.output_item.done', { output_index: 0, item: done });
  send('response.completed', {
    response: responseObject('completed', {
      output: [done],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
    }),
  });
  response.end();
}
