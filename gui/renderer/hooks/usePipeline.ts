import { useEffect } from 'react';
import { usePipelineStore } from '../store/pipeline-store';
import type { ProgressData, ResultData } from '../../types/electron';

/**
 * Hook that subscribes to pipeline IPC events (progress, result, logs).
 * Includes proper cleanup to prevent memory leaks.
 */
export function usePipeline() {
  const {
    currentStage,
    isRunning,
    progress,
    lastResult,
    error,
    startPipeline,
    stopPipeline,
    setProgress,
    setResult,
    reset,
  } = usePipelineStore();

  // Subscribe to pipeline:progress
  useEffect(() => {
    const cleanup = window.electronAPI.pipeline.onProgress((data: ProgressData) => {
      setProgress(data);
    });
    return cleanup;
  }, [setProgress]);

  // Subscribe to pipeline:result
  useEffect(() => {
    const cleanup = window.electronAPI.pipeline.onResult((data: ResultData) => {
      setResult(data);
    });
    return cleanup;
  }, [setResult]);

  return {
    currentStage,
    isRunning,
    progress,
    lastResult,
    error,
    startPipeline,
    stopPipeline,
    reset,
  };
}
