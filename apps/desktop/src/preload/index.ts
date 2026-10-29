import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { channels, type HarnessApi, hiddenWindowArgument, type SpokenDecision } from '../shared/api.ts';

const api: HarnessApi = {
  startRound: (kind) => ipcRenderer.invoke(channels.startRound, kind),
  roundSnapshot: () => ipcRenderer.invoke(channels.roundSnapshot),
  endRound: () => ipcRenderer.invoke(channels.endRound),
  signal: (signal) => ipcRenderer.send(channels.signal, signal),
  onDecision(listener) {
    const handler = (_event: IpcRendererEvent, decision: SpokenDecision) => listener(decision);
    ipcRenderer.on(channels.decision, handler);
    return () => ipcRenderer.off(channels.decision, handler);
  },
  setTheme: (theme) => ipcRenderer.invoke(channels.setTheme, theme),
  windowHidden: process.argv.includes(hiddenWindowArgument),
};

contextBridge.exposeInMainWorld('harness', api);
