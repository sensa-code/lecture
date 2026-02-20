import { contextBridge, ipcRenderer } from 'electron';

/** Type-safe API exposed to renderer via contextBridge */
const electronAPI = {
  // Environment / API Key management
  env: {
    getKey: (keyName: string): Promise<string> =>
      ipcRenderer.invoke('env:get', keyName),
    setKey: (keyName: string, value: string): Promise<void> =>
      ipcRenderer.invoke('env:set', keyName, value),
    getAllKeys: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('env:get-all'),
    validate: (keyName: string): Promise<{ valid: boolean; error?: string }> =>
      ipcRenderer.invoke('env:validate', keyName),
  },

  // Pipeline execution
  pipeline: {
    start: (stage: string, params: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke('pipeline:start', { stage, params }),
    stop: (): Promise<void> =>
      ipcRenderer.invoke('pipeline:stop'),
    onProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { stage: string; current: number; total: number; message: string }) => callback(data);
      ipcRenderer.on('pipeline:progress', handler);
      return () => ipcRenderer.removeListener('pipeline:progress', handler);
    },
    onResult: (callback: (data: { success: boolean; data?: unknown; error?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { success: boolean; data?: unknown; error?: string }) => callback(data);
      ipcRenderer.on('pipeline:result', handler);
      return () => ipcRenderer.removeListener('pipeline:result', handler);
    },
  },

  // Log streaming
  log: {
    onMessage: (callback: (data: { level: string; message: string; timestamp: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { level: string; message: string; timestamp: string }) => callback(data);
      ipcRenderer.on('pipeline:log', handler);
      return () => ipcRenderer.removeListener('pipeline:log', handler);
    },
  },

  // File operations
  file: {
    open: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
      ipcRenderer.invoke('file:open', options ?? {}),
    save: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
      ipcRenderer.invoke('file:save', options ?? {}),
    readJson: (filePath: string): Promise<{ success: boolean; data?: unknown; error?: string }> =>
      ipcRenderer.invoke('file:read-json', filePath),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
