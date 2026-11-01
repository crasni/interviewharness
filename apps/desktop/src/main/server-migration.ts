import { isServerAddress } from '../shared/settings.ts';

/** The id v0.1's one server gets when it becomes a named server. Its key moves to this id too (see setUpModels). */
export const migratedServerId = 'v0-1-server';

type Raw = Record<string, unknown>;

/**
 * v0.1 → v0.1.1: the one OpenAI-compatible server (`serverAddress`) becomes a named server, named after
 * its host. Models picked from it, or marked small, now name it. Without a server, models picked from
 * one are unpicked. Part of settings version 1 → 2.
 */
export function oneServerBecomesNamed({ serverAddress, ...raw }: Raw): Raw {
  const address = isServerAddress(serverAddress) ? serverAddress : null;
  const server = address ? { id: migratedServerId, name: new URL(address).host, address, format: 'openai' } : null;

  const follow = (choice: unknown) => {
    const onServer = typeof choice === 'object' && choice !== null && (choice as Raw).provider === 'server';
    if (!onServer) return choice;
    return server ? { provider: 'server', server: server.id, model: (choice as Raw).model } : null;
  };
  const changes: Raw = { servers: server ? [server] : [] };
  for (const slot of ['interviewerModel', 'feedbackModel'] as const) if (slot in raw) changes[slot] = follow(raw[slot]);
  // Your models (settings v2) may already hold the server's models, depending on which step runs first.
  if (Array.isArray(raw.yourModels)) changes.yourModels = raw.yourModels.map(follow).filter((choice) => choice !== null);
  if (Array.isArray(raw.smallModels)) {
    changes.smallModels = raw.smallModels.flatMap((key) =>
      typeof key === 'string' && key.startsWith('server/') ? (server ? [`server/${server.id}/${key.slice('server/'.length)}`] : []) : [key],
    );
  }
  return { ...raw, ...changes };
}
