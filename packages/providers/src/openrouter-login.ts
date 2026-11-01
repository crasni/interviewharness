import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OAuthAuth, OAuthCredential } from '@earendil-works/pi-ai';

/**
 * "Sign in with OpenRouter": OpenRouter's PKCE flow for apps (https://openrouter.ai/docs/use-cases/oauth-pkce),
 * as pi-ai implements it, with a loopback redirect. OpenRouter trades the code for an API key that belongs
 * to the candidate and never expires, so there is nothing to refresh: the key is used exactly like a pasted
 * one. It's kept as a login (type "oauth") only so the app can tell a sign-in from a pasted key.
 *
 * Our own rather than pi-ai's, as with ChatGPT's (chatgpt-login.ts): pi-ai loads its flow through a path no
 * bundler can follow, and races the browser against a typed-in code, which this app never asks for.
 */

/** The browser has this long to come back; then the sign-in gives up. */
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const EXCHANGE_TIMEOUT_MS = 30_000;

export interface OpenRouterLoginConfig {
  /** OpenRouter's site. Tests use a fake on loopback. */
  origin?: string;
  fetch?: typeof fetch;
}

export function openrouterOAuth({ origin = 'https://openrouter.ai', fetch: fetchFn = globalThis.fetch }: OpenRouterLoginConfig = {}): OAuthAuth {
  async function exchange(code: string, verifier: string, signal: AbortSignal): Promise<string> {
    const response = await fetchFn(`${origin}/api/v1/auth/keys`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(EXCHANGE_TIMEOUT_MS)]),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const detail = errorDetail(body);
      throw new Error(`OpenRouter key exchange failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    if (typeof body.key !== 'string' || !body.key) throw new Error('OpenRouter issued no key');
    return body.key;
  }

  return {
    name: 'OpenRouter',
    loginLabel: 'Sign in with OpenRouter',

    async login(interaction) {
      const signal = AbortSignal.any([interaction.signal, AbortSignal.timeout(LOGIN_TIMEOUT_MS)]);
      signal.throwIfAborted();
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      // OpenRouter sends back no state; a path no one else knows keeps stray requests from completing it.
      const path = `/oauth/callback/${randomUUID()}`;
      const callback = await listenForCallback(path);
      try {
        const page = new URL(`${origin}/auth`);
        page.search = new URLSearchParams({
          callback_url: `http://127.0.0.1:${(callback.server.address() as AddressInfo).port}${path}`,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        }).toString();
        interaction.notify({ type: 'auth_url', url: page.toString() });

        const code = await untilAborted(callback.result, signal);
        const key = await exchange(code, verifier, signal);
        return { type: 'oauth', access: key, refresh: '', expires: Number.MAX_SAFE_INTEGER } satisfies OAuthCredential;
      } finally {
        callback.server.close();
        // A browser keeps spare connections open; without this the listener would outlive the sign-in.
        callback.server.closeAllConnections();
      }
    },

    // The key never expires; there's nothing to refresh.
    async refresh(stored) {
      return stored;
    },

    async toAuth(stored) {
      return { apiKey: stored.access };
    },
  };
}

function errorDetail(body: Record<string, unknown>): string | undefined {
  for (const field of ['error_description', 'message', 'error'] as const) if (typeof body[field] === 'string') return body[field];
  const error = body.error as { message?: unknown } | undefined;
  return typeof error?.message === 'string' ? error.message : undefined;
}

/** Listens on a free loopback port for the browser's one redirect back from OpenRouter. */
function listenForCallback(path: string): Promise<{ server: Server; result: Promise<string> }> {
  let settle!: { resolve: (code: string) => void; reject: (error: Error) => void };
  let answered = false;
  const result = new Promise<string>((resolve, reject) => (settle = { resolve, reject }));
  result.catch(() => {}); // handled by whoever awaits it; never an unhandled rejection if the sign-in ends first

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const reply = (status: number, message: string) => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><meta charset="utf-8"><title>InterviewHarness</title><p style="font: 16px system-ui; margin: 4em auto; max-width: 30em">${message}</p>`);
    };
    if (request.method !== 'GET' || url.pathname !== path) return reply(404, 'Not found.');
    if (answered) return reply(409, 'This sign-in has already come back.');
    if (url.searchParams.get('error')) {
      answered = true;
      reply(400, "OpenRouter wasn't connected. You can close this tab and try again in InterviewHarness.");
      return settle.reject(new Error(`OpenRouter sign-in failed: ${url.searchParams.get('error')}`));
    }
    const code = url.searchParams.get('code');
    if (!code) return reply(400, 'This sign-in link is out of date.');
    answered = true;
    reply(200, "You're signed in. You can close this tab and go back to InterviewHarness.");
    settle.resolve(code);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, result }));
  });
}

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Sign-in cancelled'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
