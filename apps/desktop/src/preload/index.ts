import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { channels, type HarnessApi, type InterviewerEvent } from '../shared/api.ts';
import type { Settings } from '../shared/settings.ts';

const api: HarnessApi = {
  startRound: (kind) => ipcRenderer.invoke(channels.startRound, kind),
  roundSnapshot: () => ipcRenderer.invoke(channels.roundSnapshot),
  endRound: (code) => ipcRenderer.invoke(channels.endRound, code),
  feedback: {
    result: () => ipcRenderer.invoke(channels.feedbackResult),
    retry: () => ipcRenderer.invoke(channels.feedbackRetry),
  },
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
    list: (provider, connection) => ipcRenderer.invoke(channels.listModels, provider, connection),
    connect: (connection) => ipcRenderer.invoke(channels.connect, connection),
    logout: (provider, server) => ipcRenderer.invoke(channels.logout, provider, server),
    removeModel: (model) => ipcRenderer.invoke(channels.removeModel, model),
    listServer: (listing) => ipcRenderer.invoke(channels.listServer, listing),
    addServer: (setup) => ipcRenderer.invoke(channels.addServer, setup),
    editServer: (setup) => ipcRenderer.invoke(channels.editServer, setup),
  },
};

contextBridge.exposeInMainWorld('harness', api);
