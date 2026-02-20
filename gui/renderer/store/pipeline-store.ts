import { create } from 'zustand';
import type { LogData, ProgressData, ResultData } from '../../types/electron';

type PipelineStage = 'idle' | 'knowledge' | 'syllabus' | 'lessons' | 'quality' | 'video';

interface PipelineState {
  currentStage: PipelineStage;
  isRunning: boolean;
  progress: ProgressData | null;
  logs: LogData[];
  lastResult: ResultData | null;
  error: string | null;

  // Actions
  setStage: (stage: PipelineStage) => void;
  setRunning: (running: boolean) => void;
  setProgress: (progress: ProgressData) => void;
  addLog: (log: LogData) => void;
  clearLogs: () => void;
  setResult: (result: ResultData) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Pipeline operations
  startPipeline: (stage: string, params: Record<string, unknown>) => Promise<void>;
  stopPipeline: () => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  currentStage: 'idle',
  isRunning: false,
  progress: null,
  logs: [],
  lastResult: null,
  error: null,

  setStage: (stage) => set({ currentStage: stage }),
  setRunning: (running) => set({ isRunning: running }),
  setProgress: (progress) => set({ progress }),
  addLog: (log) => set(state => ({
    logs: [...state.logs.slice(-499), log], // Keep max 500
  })),
  clearLogs: () => set({ logs: [] }),
  setResult: (result) => set({ lastResult: result, isRunning: false }),
  setError: (error) => set({ error, isRunning: false }),
  reset: () => set({
    currentStage: 'idle',
    isRunning: false,
    progress: null,
    lastResult: null,
    error: null,
  }),

  startPipeline: async (stage, params) => {
    const { setRunning, setStage, setError } = get();
    setRunning(true);
    setStage(stage as PipelineStage);
    setError(null);

    try {
      await window.electronAPI.pipeline.start(stage, params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline failed to start');
    }
  },

  stopPipeline: async () => {
    try {
      await window.electronAPI.pipeline.stop();
    } catch (err) {
      console.error('Failed to stop pipeline:', err);
    }
    set({ isRunning: false, currentStage: 'idle' });
  },
}));
