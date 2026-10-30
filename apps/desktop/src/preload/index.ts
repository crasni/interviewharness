import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { channels, type HarnessApi, type InterviewerEvent } from '../shared/api.ts';
import type { Settings } from '../shared/settings.ts';

const api: HarnessApi = {
  startRound: (kind) => ipcRenderer.invoke(channels.startRound, kind),
  roundSnapshot: () => ipcRenderer.invoke(channels.roundSnapshot),
  endRound: () => ipcRenderer.invoke(channels.endRound),
  signal: (signal) => ipcRenderer.send(channels.signal, signal),
  onDecision(listener) {
    const handler = (_event: IpcRendererEvent, decision: InterviewerEvent) => listener(decision);
    ipcRenderer.on(channels.decision, handler);
    return () => ipcRenderer.off(channels.decision, handler);
  },
  setTheme: (theme) => ipcRenderer.invoke(channels.setTheme, theme),
  settings: {
    get: () => ipcRenderer.invoke(channels.getSettings),
    change: (changes) => ipcRenderer.send(channels.changeSettings, changes),
    onChange(listener) {
      const handler = (_event: IpcRendererEvent, values: Settings) => listener(values);
      ipcRenderer.on(channels.settingsChanged, handler);
      return () => ipcRenderer.off(channels.settingsChanged, handler);
    },
  },
  models: {
    continueWithChatGPT: () => ipcRenderer.invoke(channels.continueWithChatGPT),
    cancelLogin: () => ipcRenderer.send(channels.cancelLogin),
    providers: () => ipcRenderer.invoke(channels.providers),
    logout: (provider) => ipcRenderer.invoke(channels.logout, provider),
  },
};

contextBridge.exposeInMainWorld('harness', api);
