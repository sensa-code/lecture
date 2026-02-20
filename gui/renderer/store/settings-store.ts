import { create } from 'zustand';

interface ApiKeyEntry {
  name: string;
  label: string;
  value: string;
  isValid: boolean | null; // null = not validated yet
  error?: string;
}

interface SettingsState {
  apiKeys: ApiKeyEntry[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setApiKeys: (keys: ApiKeyEntry[]) => void;
  updateKey: (name: string, value: string) => void;
  setKeyValidation: (name: string, isValid: boolean, error?: string) => void;
  loadKeys: () => Promise<void>;
  saveKey: (name: string, value: string) => Promise<void>;
}

const API_KEY_DEFINITIONS = [
  { name: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
  { name: 'SUPABASE_URL', label: 'Supabase URL' },
  { name: 'SUPABASE_KEY', label: 'Supabase Anon Key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key' },
  { name: 'HEYGEN_API_KEY', label: 'HeyGen API Key' },
  { name: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key' },
];

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKeys: API_KEY_DEFINITIONS.map(d => ({
    ...d,
    value: '',
    isValid: null,
  })),
  isLoading: false,
  error: null,

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setApiKeys: (keys) => set({ apiKeys: keys }),

  updateKey: (name, value) => set(state => ({
    apiKeys: state.apiKeys.map(k =>
      k.name === name ? { ...k, value, isValid: null, error: undefined } : k
    ),
  })),

  setKeyValidation: (name, isValid, error) => set(state => ({
    apiKeys: state.apiKeys.map(k =>
      k.name === name ? { ...k, isValid, error } : k
    ),
  })),

  loadKeys: async () => {
    const { setLoading, setError } = get();
    setLoading(true);
    setError(null);
    try {
      const allKeys = await window.electronAPI.env.getAllKeys();
      set(state => ({
        apiKeys: state.apiKeys.map(k => ({
          ...k,
          value: allKeys[k.name] || '',
          isValid: null,
        })),
        isLoading: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
      setLoading(false);
    }
  },

  saveKey: async (name, value) => {
    try {
      await window.electronAPI.env.setKey(name, value);
      set(state => ({
        apiKeys: state.apiKeys.map(k =>
          k.name === name ? { ...k, value } : k
        ),
      }));
    } catch (err) {
      const { setError } = get();
      setError(err instanceof Error ? err.message : 'Failed to save key');
    }
  },
}));
