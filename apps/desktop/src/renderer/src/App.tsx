import type { RoundSnapshot } from '@interviewharness/engine';
import { useState } from 'react';
import { Debrief } from './debrief/Debrief.tsx';
import { Room } from './room/Room.tsx';
import { SettingsPanel } from './settings/SettingsPanel.tsx';
import { SettingsProvider } from './settings/settings.tsx';
import { StartScreen } from './start/StartScreen.tsx';

type Screen = { name: 'start' } | { name: 'room'; round: RoundSnapshot } | { name: 'debrief'; round: RoundSnapshot };

export function App() {
  return (
    <SettingsProvider>
      <Screens />
      <SettingsPanel />
    </SettingsProvider>
  );
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });

  switch (screen.name) {
    case 'start':
      return (
        <StartScreen onStart={async (kind) => setScreen({ name: 'room', round: await window.harness.startRound(kind) })} />
      );
    case 'room':
      return (
        <Room
          initial={screen.round}
          // Main only lacks a round if it already ended; the room's last known state is the best we have.
          onEnd={async () => setScreen({ name: 'debrief', round: (await window.harness.endRound()) ?? screen.round })}
        />
      );
    case 'debrief':
      return <Debrief round={screen.round} onBack={() => setScreen({ name: 'start' })} />;
  }
}
