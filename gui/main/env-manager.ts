import Store from 'electron-store';
import type { IpcMain } from 'electron';

const API_KEY_NAMES = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'HEYGEN_API_KEY',
  'ELEVENLABS_API_KEY',
] as const;

type ApiKeyName = typeof API_KEY_NAMES[number];

interface EnvStoreSchema {
  [key: string]: string;
}

const store = new Store<EnvStoreSchema>({
  name: 'vet-course-api-keys',
  encryptionKey: 'vet-course-gui-v1-secure',
  defaults: Object.fromEntries(API_KEY_NAMES.map(k => [k, ''])),
});

/** Get a single API key value */
export function getKey(keyName: string): string {
  return store.get(keyName, '') as string;
}

/** Set a single API key value */
export function setKey(keyName: string, value: string): void {
  store.set(keyName, value);
}

/** Get all API keys */
export function getAllKeys(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of API_KEY_NAMES) {
    result[key] = getKey(key);
  }
  return result;
}

/** Inject all stored API keys into process.env before pipeline execution */
export function injectEnv(): void {
  for (const key of API_KEY_NAMES) {
    const value = getKey(key);
    if (value) {
      process.env[key] = value;
    }
  }
}

/** Validate that a specific API key is set and non-empty */
export function validateKey(keyName: string): { valid: boolean; error?: string } {
  const value = getKey(keyName);
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${keyName} is not set` };
  }
  // Basic format validation
  if (keyName === 'ANTHROPIC_API_KEY' && !value.startsWith('sk-ant-')) {
    return { valid: false, error: 'ANTHROPIC_API_KEY should start with "sk-ant-"' };
  }
  if (keyName === 'SUPABASE_URL' && !value.includes('supabase.co')) {
    return { valid: false, error: 'SUPABASE_URL should contain "supabase.co"' };
  }
  return { valid: true };
}

/** Register IPC handlers for env management */
export function registerEnvHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('env:get', (_event, keyName: string) => {
    return getKey(keyName);
  });

  ipcMain.handle('env:set', (_event, keyName: string, value: string) => {
    setKey(keyName, value);
  });

  ipcMain.handle('env:get-all', () => {
    return getAllKeys();
  });

  ipcMain.handle('env:validate', (_event, keyName: string) => {
    return validateKey(keyName);
  });
}
