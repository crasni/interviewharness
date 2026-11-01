import { randomUUID } from 'node:crypto';
import { type ModelErrorKind, modelErrorKind } from '@interviewharness/engine';
import type { ModelChoice, Providers, Server } from '@interviewharness/providers';
import { serverFormats } from '@interviewharness/providers/defaults';
import type { ConnectResult, ModelList, ServerListing, ServerSetup } from '../shared/api.ts';
import { isServerAddress, isServerId, isServerName, type Settings, settingsAfterRemovingServer, withYourModel } from '../shared/settings.ts';

const isFormat = (value: unknown): value is Server['format'] => (serverFormats as readonly unknown[]).includes(value);
const isKey = (value: unknown): value is string | undefined => value === undefined || (typeof value === 'string' && value.length <= 500);
const isModelId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;

/** Checks a server's setup arriving over IPC, all but the fields the candidate types freely (named in plain errors instead). */
function isServerSetup(value: unknown, editing: boolean): value is ServerSetup {
  if (typeof value !== 'object' || value === null) return false;
  const { slot, server, name, address, format, key, model } = value as Record<string, unknown>;
  if (slot !== undefined && slot !== 'interviewer' && slot !== 'feedback') return false;
  if (editing ? !isServerId(server) : server !== undefined) return false;
  return typeof name === 'string' && name.length <= 200 && typeof address === 'string' && address.length <= 500 && isFormat(format) && isKey(key) && typeof model === 'string' && model.length <= 200;
}

function isServerListing(value: unknown): value is ServerListing {
  if (typeof value !== 'object' || value === null) return false;
  const { server, address, format, key } = value as Record<string, unknown>;
  if (server !== undefined && !isServerId(server)) return false;
  if (server === undefined && address === undefined) return false;
  return (address === undefined || typeof address === 'string') && (format === undefined || isFormat(format)) && isKey(key);
}

/**
 * The candidate's own servers: adding, editing and removing them, each by name, OpenAI- or
 * Anthropic-compatible, with an optional key kept under the server's own id. Nothing is saved until a
 * model on the server answers; anything that fails says which field to fix.
 */
export function serverConnections({
  providers,
  settings,
  encrypted = () => true,
  newId = () => randomUUID(),
}: {
  providers: Providers;
  settings: { values(): Settings; change(changes: Partial<Settings>): unknown };
  /** Whether saved keys are encrypted by the OS (not on Linux with no keyring). */
  encrypted?: () => boolean;
  /** Makes a new server's id. */
  newId?: () => string;
}) {
  /** What's wrong with the fields typed in, before anything is asked of the server; null when nothing is. */
  function fieldError({ server, name, address, model }: ServerSetup): string | null {
    if (!isServerName(name)) return 'Name: give the server a name, so you can tell it apart.';
    const taken = settings.values().servers.some((each) => each.id !== server && each.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (taken) return `Name: another server is called "${name.trim()}". Pick another name.`;
    if (!isServerAddress(address)) return 'Address: enter a web address starting with http:// or https://, e.g. http://localhost:1234/v1.';
    if (!isModelId(model)) return 'Model: pick a model, or type its id.';
    return null;
  }

  /** Checks the model on the server as set up, then saves the server, its key and the model. */
  async function save(request: ServerSetup, id: string): Promise<ConnectResult> {
    const wrong = fieldError(request);
    if (wrong) return { ok: false, error: wrong };
    const { slot, name, address, format, model } = request;
    const key = request.key?.trim() || undefined;
    const choice: ModelChoice = { provider: 'server', server: id, model: model.trim() };
    try {
      await providers.check(choice, { address, format, ...(key ? { key } : {}) });
    } catch (error) {
      return { ok: false, error: plainServerError(modelErrorKind(error), { address, format, key, model }, error, 'check') };
    }
    if (key) await providers.saveServerKey(id, key);
    const unencryptedNote = !!key && !encrypted() && !settings.values().unencryptedLoginNoted;
    const server: Server = { id, name: name.trim(), address, format };
    const saved = settings.values().servers;
    settings.change({
      servers: saved.some((each) => each.id === id) ? saved.map((each) => (each.id === id ? server : each)) : [...saved, server],
      yourModels: withYourModel(settings.values().yourModels, choice),
      ...(slot === 'interviewer' ? { interviewerModel: choice } : slot === 'feedback' ? { feedbackModel: choice } : {}),
      ...(unencryptedNote ? { unencryptedLoginNoted: true } : {}),
    });
    return { ok: true, unencryptedNote };
  }

  return {
    /** A server's models: a saved one's, or through an address, format or key not saved yet. */
    async list(request: unknown): Promise<ModelList> {
      if (!isServerListing(request)) return { ok: false, error: "Those models can't be listed." };
      const saved = settings.values().servers.find((each) => each.id === request.server);
      const address = request.address ?? saved?.address;
      const format = request.format ?? saved?.format ?? 'openai';
      if (!isServerAddress(address)) return { ok: false, error: 'Address: enter a web address starting with http:// or https://, e.g. http://localhost:1234/v1.' };
      try {
        return { ok: true, models: await providers.listModels('server', request) };
      } catch (error) {
        const key = request.key?.trim() || undefined;
        return { ok: false, error: plainServerError(modelErrorKind(error), { address, format, key }, error, 'list') };
      }
    },

    /** Adds a server once a model on it answers; the model joins your models (and `slot`, if given). */
    async add(request: unknown): Promise<ConnectResult> {
      if (!isServerSetup(request, false)) return { ok: false, error: "That server can't be added." };
      // Tried under a fresh id, so a refused key never touches another server's.
      return save(request, newId());
    },

    /** Changes a server's name, address, format or key once a model on it answers. No key typed keeps the saved one. */
    async edit(request: unknown): Promise<ConnectResult> {
      if (!isServerSetup(request, true) || !settings.values().servers.some((each) => each.id === request.server)) {
        return { ok: false, error: "That server can't be changed." };
      }
      return save(request, request.server!);
    },

    /** Forgets a server and its key, and takes its models off your models and the slots. */
    async remove(server: unknown) {
      if (!isServerId(server)) return;
      await providers.forgetServer(server);
      settings.change(settingsAfterRemovingServer(settings.values(), server));
    },
  };
}

/**
 * Why a server didn't answer, or its models couldn't be listed, starting with the field to fix
 * ("Address: …", "Key: …", "Model: …"). Never repeats a key: the providers take the key they sent out of
 * their errors (a saved one too), and a key typed in is taken out here as well.
 */
export function plainServerError(
  kind: ModelErrorKind,
  { address, format, key, model }: { address: string; format: Server['format']; key?: string; model?: string },
  error: unknown,
  doing: 'list' | 'check',
) {
  const said = error instanceof Error ? error.message : String(error);
  const endsInV1 = /\/v1\/?$/.test(address);
  switch (kind) {
    case 'offline':
      return `Address: nothing answered at ${address}. Check the address, and that the server is running.`;
    case 'auth':
      return key ? 'Key: the server refused the key. Check it and try again.' : 'Key: the server asks for a key. Add it and try again.';
    case 'rate-limit':
      return "The server says you've hit a rate limit or used up your quota. Try again later.";
    case 'timeout':
      return `Model: ${model ?? 'the model'} didn't answer within a minute. A local model may still be loading; try again.`;
    default: {
      if (/\b404\b/.test(said)) {
        if (format === 'openai' && !endsInV1) return `Address: nothing was found at ${address}. The address usually ends in /v1, e.g. http://localhost:1234/v1.`;
        if (format === 'anthropic' && endsInV1) return `Address: nothing was found there. For an Anthropic-compatible server, enter the address without /v1: it's added for you.`;
        if (doing === 'list') return "Model: this server doesn't list its models. Type the model's id instead.";
        return `Model: the server doesn't know ${model ?? 'that model'}. Check the model's id, or that the API format is right.`;
      }
      const safe = (key ? said.replaceAll(key, '…') : said).slice(0, 200);
      return doing === 'list' ? `The server's models couldn't be listed: ${safe}` : `Model: ${model ?? 'the model'} didn't answer: ${safe}`;
    }
  }
}
