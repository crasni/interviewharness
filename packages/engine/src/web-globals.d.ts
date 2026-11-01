// The engine compiles without DOM or Node types, so that it stays free of either. These few standard
// globals exist the same way in both, and are all it uses.

interface AbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
}

declare class AbortController {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}

declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(id: unknown): void;
