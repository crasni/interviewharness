import type { RoundKind } from '@interviewharness/core';
import type { RoundSnapshot } from '@interviewharness/engine';

// The only surface the renderer has into the main process.
export interface HarnessApi {
  startRound(kind: RoundKind): Promise<RoundSnapshot>;
  roundSnapshot(): Promise<RoundSnapshot | null>;
}

export const channels = {
  startRound: 'round:start',
  roundSnapshot: 'round:snapshot',
} as const;
