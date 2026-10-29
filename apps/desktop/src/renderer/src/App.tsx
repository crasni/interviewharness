import type { RoundSnapshot } from '@interviewharness/engine';
import { useState } from 'react';
import { Room } from './room/Room.tsx';
import { StartScreen } from './start/StartScreen.tsx';

export function App() {
  const [round, setRound] = useState<RoundSnapshot | null>(null);

  if (!round) {
    return <StartScreen onStart={async (kind) => setRound(await window.harness.startRound(kind))} />;
  }
  return <Room initial={round} />;
}
