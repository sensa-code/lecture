/** Type definitions for the electronAPI exposed via contextBridge */

export interface ProgressData {
  stage: string;
  current: number;
  total: number;
  message: string;
}

export interface ResultData {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface LogData {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface FileReadResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ElectronAPI {
  env: {
    getKey: (keyName: string) => Promise<string>;
    setKey: (keyName: string, value: string) => Promise<void>;
    getAllKeys: () => Promise<Record<string, string>>;
    validate: (keyName: string) => Promise<ValidationResult>;
  };
  pipeline: {
    start: (stage: string, params: Record<string, unknown>) => Promise<void>;
    stop: () => Promise<void>;
    onProgress: (callback: (data: ProgressData) => void) => () => void;
    onResult: (callback: (data: ResultData) => void) => () => void;
  };
  log: {
    onMessage: (callback: (data: LogData) => void) => () => void;
  };
  file: {
    open: (options?: { filters?: FileFilter[] }) => Promise<string | null>;
    save: (options?: { defaultPath?: string; filters?: FileFilter[] }) => Promise<string | null>;
    readJson: (filePath: string) => Promise<FileReadResult>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
