import { useCallback } from 'react';
import type { FileReadResult, FileFilter } from '../../types/electron';

/** Hook for IPC file operations — uses window.electronAPI (never imports electron directly) */
export function useFileDialog() {
  const openFile = useCallback(async (filters?: FileFilter[]): Promise<string | null> => {
    return window.electronAPI.file.open({ filters });
  }, []);

  const saveFile = useCallback(async (defaultPath?: string, filters?: FileFilter[]): Promise<string | null> => {
    return window.electronAPI.file.save({ defaultPath, filters });
  }, []);

  const readJson = useCallback(async (filePath: string): Promise<FileReadResult> => {
    return window.electronAPI.file.readJson(filePath);
  }, []);

  return { openFile, saveFile, readJson };
}

/** Hook for IPC environment/API key operations */
export function useEnv() {
  const getKey = useCallback(async (keyName: string): Promise<string> => {
    return window.electronAPI.env.getKey(keyName);
  }, []);

  const setKey = useCallback(async (keyName: string, value: string): Promise<void> => {
    return window.electronAPI.env.setKey(keyName, value);
  }, []);

  const getAllKeys = useCallback(async (): Promise<Record<string, string>> => {
    return window.electronAPI.env.getAllKeys();
  }, []);

  const validateKey = useCallback(async (keyName: string) => {
    return window.electronAPI.env.validate(keyName);
  }, []);

  return { getKey, setKey, getAllKeys, validateKey };
}
