import { useState } from 'react';
import type { RoomSnapshot } from '../../shared/api.ts';
import type { Settings } from '../../shared/settings.ts';
import { FeedbackScreen } from './feedback/FeedbackScreen.tsx';
import { Room } from './room/Room.tsx';
import { SettingsPanel } from './settings/SettingsPanel.tsx';
import { SettingsProvider } from './settings/settings.tsx';
import { StartScreen } from './start/StartScreen.tsx';

type Screen = { name: 'start' } | { name: 'room'; round: RoomSnapshot } | { name: 'feedback'; round: RoomSnapshot };

export function App({ settings }: { settings: Settings }) {
  return (
    <SettingsProvider initial={settings}>
      <div className="window-drag" aria-hidden="true" />
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
        <StartScreen
          onStart={async (kind, problem) => setScreen({ name: 'room', round: await window.harness.startRound(kind, problem) })}
        />
      );
    case 'room':
      return (
        <Room
          initial={screen.round}
          // Main only lacks a round if it already ended; the room's last known state is the best we have.
          onEnd={async (code) => setScreen({ name: 'feedback', round: (await window.harness.endRound(code)) ?? screen.round })}
        />
      );
    case 'feedback':
      return <FeedbackScreen round={screen.round} onBack={() => setScreen({ name: 'start' })} />;
  }
}
