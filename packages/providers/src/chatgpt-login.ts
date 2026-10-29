import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OAuthAuth, OAuthCredential } from '@earendil-works/pi-ai';

/**
 * "Sign in with ChatGPT" for open-source apps that run locally: OpenAI's public-client flow, with
 * dynamic client registration, PKCE and a loopback redirect, and no client secret
 * (https://developers.openai.com/siwc/token-sharing-open-source/sign-in.md).
 *
 * Our own rather than pi-ai's, for three reasons: pi-ai loads its flow through a path no bundler can
 * follow, so it would be missing from the built app; the only bundled form also registers the Claude
 * consumer login, which we never ship; and pi-ai's fixed port 1455 clashes with the Codex CLI, where
 * OpenAI allows any loopback port.
 */

const DYNAMIC_CLIENT_ID = 'dynamic_agent_client';
const RESOURCE = 'https://api.openai.com/v1';
const DIRECT_TOKEN_SCOPE = 'chatgpt.tokens.use.direct';
const SCOPE = `openid profile email offline_access resource.invoke ${DIRECT_TOKEN_SCOPE}`;
const CALLBACK_PATH = '/auth/callback';
/** Refreshed this long before it really expires, so no request starts with a token about to lapse. */
const EXPIRY_MARGIN_MS = 3 * 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChatGPTLoginConfig {
  /** OpenAI's sign-in server. Tests use a fake on loopback. */
  authOrigin?: string;
  fetch?: typeof fetch;
}

const random = () => randomBytes(32).toString('base64url');

export function chatgptOAuth({ authOrigin = 'https://auth.openai.com', fetch: fetchFn = globalThis.fetch }: ChatGPTLoginConfig = {}): OAuthAuth {
  async function requestToken(body: Record<string, string>, signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await fetchFn(`${authOrigin}/api/accounts/oauth/token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
      signal,
    });
    if (!response.ok) throw new Error(`OpenAI token request failed (${response.status})`);
    return (await response.json()) as Record<string, unknown>;
  }

  function credential(token: Record<string, unknown>, clientId: string): OAuthCredential {
    const { access_token: access, refresh_token: refresh, expires_in: expiresIn, scope } = token;
    if (typeof access !== 'string' || typeof refresh !== 'string' || typeof expiresIn !== 'number' || typeof scope !== 'string') {
      throw new Error('OpenAI token response is missing a field');
    }
    const scopes = scope.split(/\s+/).filter(Boolean);
    if (!scopes.includes(DIRECT_TOKEN_SCOPE)) throw new Error(`OpenAI didn't grant ${DIRECT_TOKEN_SCOPE}`);
    return { type: 'oauth', access, refresh, expires: Date.now() + expiresIn * 1000 - EXPIRY_MARGIN_MS, clientId, scopes };
  }

  return {
    name: 'ChatGPT',
    isSubscription: true,
    loginLabel: 'Continue with ChatGPT',

    async login(interaction, options) {
      const { signal } = interaction;
      const deviceId = options?.getDeviceId?.();
      if (!deviceId || !uuid.test(deviceId)) throw new Error('Sign in with ChatGPT needs a UUID for this installation');
      signal.throwIfAborted();

      const verifier = random();
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const state = random();
      const callback = await listenForCallback(state);
      try {
        const redirectUri = `http://127.0.0.1:${(callback.server.address() as AddressInfo).port}${CALLBACK_PATH}`;
        const page = new URL(`${authOrigin}/api/accounts/authorize`);
        page.search = new URLSearchParams({
          client_id: DYNAMIC_CLIENT_ID,
          agent_name_hint: options?.agentName ?? 'InterviewHarness',
          ext_agent_host_id: `urn:uuid:${deviceId.toLowerCase()}`,
          response_type: 'code',
          redirect_uri: redirectUri,
          resource: RESOURCE,
          scope: SCOPE,
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          nonce: random(),
        }).toString();
        interaction.notify({ type: 'auth_url', url: page.toString() });

        const { code, clientId } = await untilAborted(callback.result, signal);
        const token = await requestToken(
          { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, resource: RESOURCE },
          signal,
        );
        if (typeof token.id_token !== 'string' || !token.id_token) throw new Error('OpenAI token response has no ID token');
        return credential(token, clientId);
      } finally {
        callback.server.close();
        // A browser keeps spare connections open; without this the listener would outlive the login.
        callback.server.closeAllConnections();
      }
    },

    async refresh(stored, signal) {
      const clientId = stored.clientId;
      if (typeof clientId !== 'string' || !clientId) throw new Error('The ChatGPT login has no client id; sign in again');
      return credential(await requestToken({ grant_type: 'refresh_token', client_id: clientId, refresh_token: stored.refresh, resource: RESOURCE }, signal), clientId);
    },

    async toAuth(stored) {
      return { apiKey: stored.access };
    },
  };
}

/** Listens on a free loopback port for the browser's redirect back from OpenAI. */
function listenForCallback(state: string): Promise<{ server: Server; result: Promise<{ code: string; clientId: string }> }> {
  let settle!: { resolve: (value: { code: string; clientId: string }) => void; reject: (error: Error) => void };
  const result = new Promise<{ code: string; clientId: string }>((resolve, reject) => (settle = { resolve, reject }));
  result.catch(() => {}); // handled by whoever awaits it; never an unhandled rejection if the login ends first

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const reply = (status: number, message: string) => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><meta charset="utf-8"><title>InterviewHarness</title><p style="font: 16px system-ui; margin: 4em auto; max-width: 30em">${message}</p>`);
    };
    if (url.pathname !== CALLBACK_PATH) return reply(404, 'Not found.');
    const error = url.searchParams.get('error');
    if (error) {
      reply(400, "ChatGPT wasn't connected. You can close this tab and try again in InterviewHarness.");
      return settle.reject(new Error(`ChatGPT sign-in failed: ${error}`));
    }
    const code = url.searchParams.get('code');
    const clientId = url.searchParams.get('client_id');
    if (url.searchParams.get('state') !== state || !code || !clientId) return reply(400, 'This sign-in link is out of date.');
    reply(200, "You're signed in. You can close this tab and go back to InterviewHarness.");
    settle.resolve({ code, clientId });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, result }));
  });
}

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Login cancelled'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
