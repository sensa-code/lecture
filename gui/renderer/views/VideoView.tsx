import { useState } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import { ProgressBar } from '../components/ProgressBar';
import { CostBadge } from '../components/CostBadge';

export function VideoView() {
  const [courseId, setCourseId] = useState('');
  const [concurrency, setConcurrency] = useState(2);
  const [budget, setBudget] = useState(50);
  const [dryRun, setDryRun] = useState(true);
  const { isRunning, progress, lastResult, error, startPipeline, stopPipeline } = usePipeline();

  const isLoading = isRunning;

  const handleGenerate = async () => {
    await startPipeline('video', {
      courseId,
      concurrency,
      budget,
      dryRun,
    });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">🎬 影片生成</h1>
      <p className="text-gray-500 text-sm mb-6">Stage 06：HeyGen 數位人 + ElevenLabs TTS + Remotion 投影片</p>

      <div className="card mb-6">
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 mb-4">
          ⚠️ 影片生成將使用 HeyGen 和 ElevenLabs API，請確認已設定對應 API Keys 且預算充足。
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course ID</label>
            <input
              type="text"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder="例：vet-comm-001"
              className="input-field"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">並行數</label>
              <input
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                min={1}
                max={5}
                className="input-field"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">預算上限 (USD)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                min={1}
                max={500}
                step={5}
                className="input-field"
                disabled={isLoading}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={isLoading}
            />
            Dry Run（模擬，不呼叫 API）
          </label>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !courseId.trim()}
            className="btn-primary"
          >
            {isLoading ? '⏳ 生成中...' : '🎬 開始生成影片'}
          </button>
          {isLoading && (
            <button onClick={stopPipeline} className="btn-danger">⏹ 停止</button>
          )}
          <CostBadge spent={0} budget={budget} />
        </div>
      </div>

      {isLoading && progress && (
        <div className="card mb-6">
          <ProgressBar current={progress.current} total={progress.total} label={progress.message} />
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">❌ {error}</div>
      )}

      {lastResult?.success && (
        <div className="card bg-green-50 border-green-200">
          <h2 className="font-semibold text-green-800">✅ 完成</h2>
          <p className="text-sm text-green-600 mt-1">{JSON.stringify(lastResult.data)}</p>
        </div>
      )}
    </div>
  );
}
