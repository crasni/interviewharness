import { contextBridge, ipcRenderer } from 'electron';
import { channels, type HarnessApi } from '../shared/api.ts';

const api: HarnessApi = {
  startRound: (kind) => ipcRenderer.invoke(channels.startRound, kind),
  roundSnapshot: () => ipcRenderer.invoke(channels.roundSnapshot),
};

contextBridge.exposeInMainWorld('harness', api);
