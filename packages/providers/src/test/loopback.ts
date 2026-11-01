import { createServer, type IncomingMessage, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Credential, CredentialStore } from '@earendil-works/pi-ai';

/** Starts `handle` on a free port on loopback; resolves with its origin and a way to close it, cutting open requests. */
export async function listenOnLoopback(handle: RequestListener) {
  const server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
  });
}

/** A credential store in memory, for tests: what's saved is in `entries`. */
export function memoryCredentials(initial: Record<string, Credential> = {}): CredentialStore & { entries: Map<string, Credential> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    read: async (id) => entries.get(id),
    list: async () => [...entries].map(([providerId, credential]) => ({ providerId, type: credential.type })),
    async modify(id, fn) {
      const next = await fn(entries.get(id));
      if (next) entries.set(id, next);
      return entries.get(id);
    },
    delete: async (id) => void entries.delete(id),
  };
}
