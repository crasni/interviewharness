import type { IncomingMessage, ServerResponse } from 'node:http';
import { listenOnLoopback, readBody } from './loopback.ts';

/** What the fake does with the next request. */
export type FakeKeyReply =
  | { status: number; body: string }
  /** A reply streamed as OpenAI-compatible servers do (LM Studio, llama.cpp, vLLM, OpenRouter), or as Anthropic's format does when asked that way. */
  | { text: string; inputTokens?: number; outputTokens?: number }
  /** A reply that calls a tool (how a structured reply arrives). */
  | { toolCall: { name: string; arguments: unknown } };

export interface RecordedKeyRequest {
  method: string;
  path: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
}

/**
 * A stand-in on loopback for any provider reached with an API key. It records what arrives (to check
 * the key was sent, and nothing else was), answers with scripted replies, and lists `served` models
 * at GET …/models. It speaks both formats a server can: OpenAI's Chat Completions, and Anthropic's
 * Messages for requests to …/v1/messages (and for a models list asked for with an `anthropic-version` header).
 */
export async function fakeKeyServer(served: string[] = []) {
  const replies: FakeKeyReply[] = [];
  const requests: RecordedKeyRequest[] = [];

  const server = await listenOnLoopback(async (request, response) => {
    const raw = await readBody(request);
    const body = raw && request.headers['content-type']?.includes('json') ? JSON.parse(raw) : {};
    requests.push({ method: request.method ?? '', path: request.url ?? '', headers: request.headers, body });
    if (request.method === 'GET' && request.url?.split('?')[0]?.endsWith('/models')) {
      const next = replies[0] && 'status' in replies[0] ? replies.shift() as { status: number; body: string } : undefined;
      const listing = request.headers['anthropic-version']
        ? { data: served.map((id) => ({ type: 'model', id, display_name: id, created_at: '2026-01-01T00:00:00Z' })), has_more: false, first_id: served[0] ?? null, last_id: served.at(-1) ?? null }
        : { object: 'list', data: served.map((id) => ({ id, object: 'model', owned_by: 'local' })) };
      response.writeHead(next?.status ?? 200, { 'content-type': 'application/json' });
      response.end(next?.body ?? JSON.stringify(listing));
      return;
    }
    const next = replies.shift() ?? { status: 500, body: JSON.stringify({ error: { message: 'no reply scripted' } }) };
    if ('status' in next) {
      response.writeHead(next.status, { 'content-type': 'application/json' });
      response.end(next.body);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    if (request.url?.split('?')[0]?.endsWith('/v1/messages')) return streamAnthropic(response, body, next);
    const send = (value: unknown) => response.write(`data: ${JSON.stringify(value)}\n\n`);
    const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
      send({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] });
    if ('toolCall' in next) {
      chunk({ role: 'assistant', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: next.toolCall.name, arguments: JSON.stringify(next.toolCall.arguments) } }] });
      chunk({}, 'tool_calls');
    } else {
      chunk({ role: 'assistant', content: '' });
      const size = Math.max(1, Math.ceil(next.text.length / 3));
      for (let i = 0; i < next.text.length; i += size) chunk({ content: next.text.slice(i, i + size) });
      chunk({}, 'stop');
    }
    const input = 'inputTokens' in next ? (next.inputTokens ?? 100) : 100;
    const output = 'outputTokens' in next ? (next.outputTokens ?? 10) : 10;
    send({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 0, model: body.model, choices: [], usage: { prompt_tokens: input, completion_tokens: output, total_tokens: input + output } });
    response.write('data: [DONE]\n\n');
    response.end();
  });

  return {
    origin: server.origin,
    requests,
    reply: (...next: FakeKeyReply[]) => void replies.push(...next),
    close: server.close,
  };
}

/** A reply streamed as Anthropic's Messages API does: text in deltas, or one tool call. */
function streamAnthropic(response: ServerResponse, body: Record<string, unknown>, next: Exclude<FakeKeyReply, { status: number }>) {
  const send = (type: string, value: Record<string, unknown>) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
  const input = 'inputTokens' in next ? (next.inputTokens ?? 100) : 100;
  const output = 'outputTokens' in next ? (next.outputTokens ?? 10) : 10;
  send('message_start', {
    message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: input, output_tokens: 1 } },
  });
  if ('toolCall' in next) {
    send('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: next.toolCall.name, input: {} } });
    send('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(next.toolCall.arguments) } });
  } else {
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    const size = Math.max(1, Math.ceil(next.text.length / 3));
    for (let i = 0; i < next.text.length; i += size) send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: next.text.slice(i, i + size) } });
  }
  send('content_block_stop', { index: 0 });
  send('message_delta', { delta: { stop_reason: 'toolCall' in next ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { input_tokens: input, output_tokens: output } });
  send('message_stop', {});
  response.end();
}
