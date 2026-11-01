import { type CredentialStore, createProvider, type Model as PiModel, type ProviderAuth } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { ModelError, type ModelErrorKind } from '@interviewharness/engine';
import type { ServerFormat } from './defaults.ts';

export type { ServerFormat };

/**
 * A server of the candidate's own (LM Studio, llama.cpp, vLLM, Jan, a company gateway), by the name they
 * gave it. Kept in settings; its key, if it needs one, is kept in the credential store under its own id.
 */
export interface Server {
  /** Made when it's added; never shown, never changes. */
  id: string;
  name: string;
  /**
   * Where its API is: for the OpenAI format with its path, e.g. http://localhost:1234/v1; for the Anthropic
   * format without /v1, which is added to it (as Anthropic's own SDK does), e.g. https://gateway.example/anthropic.
   */
  address: string;
  format: ServerFormat;
}

/** The id a server not saved yet (being added) is tried under, before it's saved with an id of its own. */
export const unsavedServerId = 'new';

/**
 * The server a request describes: a saved one (`server`, its id), with any `address` or `format` given in place
 * of its own; or, with no saved one, a server not saved yet at `address`. Null when there's neither.
 */
export function resolveServer(saved: readonly Server[], { server: id = unsavedServerId, address, format }: { server?: string; address?: string; format?: ServerFormat }): Server | null {
  const found = saved.find((each) => each.id === id);
  if (!found && !address) return null;
  return { id, name: found?.name ?? '', address: address ?? found!.address, format: format ?? found?.format ?? 'openai' };
}

/** Where a server's key is kept: under its own id, so two servers never share or replace each other's key. */
export const serverCredentialId = (server: string) => `server:${server}`;

/** Where v0.1 kept the key of its one server. */
export const oldServerCredentialId = 'server';

const apiOf = { openai: 'openai-completions', anthropic: 'anthropic-messages' } as const;

/**
 * The pi-ai provider for one server: its key from the credential store if one was saved, else a
 * placeholder, as local servers need none (and the SDKs insist on one).
 */
export function serverProvider(server: string) {
  const auth: ProviderAuth = {
    apiKey: {
      name: 'Server key',
      resolve: async ({ credential }) => (credential?.key ? { auth: { apiKey: credential.key }, source: 'saved key' } : { auth: { apiKey: 'none' }, source: 'no key' }),
    },
  };
  return createProvider({
    id: serverCredentialId(server),
    name: 'Server',
    auth,
    models: [],
    api: { 'openai-completions': openAICompletionsApi(), 'anthropic-messages': anthropicMessagesApi() },
  });
}

/** A model on a server, described from its id alone: servers say little about their models. */
export function serverModel(server: Server, id: string): PiModel<'openai-completions' | 'anthropic-messages'> {
  return {
    id,
    name: id,
    api: apiOf[server.format],
    provider: serverCredentialId(server.id),
    baseUrl: server.address.replace(/\/+$/, ''),
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 4096,
  };
}

/**
 * The models a server serves, from its own models list: GET <address>/models for the OpenAI format, and
 * <address>/v1/models for Anthropic's. Fails with a typed error whose message names the status, so the
 * candidate can be told which field to fix.
 */
export async function serverModels(server: Server, key: string | undefined, fetchFn: typeof fetch) {
  const address = server.address.replace(/\/+$/, '');
  const anthropic = server.format === 'anthropic';
  const headers: Record<string, string> = anthropic ? { 'anthropic-version': '2023-06-01', ...(key ? { 'x-api-key': key } : {}) } : key ? { authorization: `Bearer ${key}` } : {};
  let response: Response;
  try {
    response = await fetchFn(`${address}${anthropic ? '/v1' : ''}/models`, { headers });
  } catch {
    throw new ModelError('offline', `Nothing answered at ${server.address}`);
  }
  if (!response.ok) throw new ModelError(statusKind(response.status), `The server answered ${response.status}`);
  let listed: { data?: { id?: unknown; display_name?: unknown }[] };
  try {
    listed = (await response.json()) as typeof listed;
  } catch {
    throw new ModelError('bad-output', 'The server answered with something other than a list of models');
  }
  return (Array.isArray(listed.data) ? listed.data : [])
    .filter((model): model is { id: string; display_name?: unknown } => typeof model?.id === 'string')
    .map((model) => ({ id: model.id, name: typeof model.display_name === 'string' && model.display_name ? model.display_name : model.id, small: false }));
}

const statusKind = (status: number): ModelErrorKind => (status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate-limit' : 'other');

/** v0.1 kept its one server's key under `server`; it moves to the server that server became. */
export async function adoptOldServerKey(credentials: CredentialStore, server: string) {
  const old = await credentials.read(oldServerCredentialId);
  if (!old) return;
  if (!(await credentials.read(serverCredentialId(server)))) await credentials.modify(serverCredentialId(server), async () => old);
  await credentials.delete(oldServerCredentialId);
}
