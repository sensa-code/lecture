import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipeline } from '../hooks/usePipeline';
import { ProgressBar } from '../components/ProgressBar';
import { StatusChip } from '../components/StatusChip';
import { CostBadge } from '../components/CostBadge';

interface QualityResult {
  file: string;
  verdict?: string;
  status: string;
}

export function QualityView() {
  const navigate = useNavigate();
  const [lessonsDir, setLessonsDir] = useState('output/lessons');
  const [sampleRate, setSampleRate] = useState(5);
  const [budget, setBudget] = useState(3);
  const [dryRun, setDryRun] = useState(false);
  const [results, setResults] = useState<QualityResult[]>([]);
  const { isRunning, progress, lastResult, error, startPipeline, stopPipeline } = usePipeline();

  const isLoading = isRunning;

  const handleCheck = async () => {
    setResults([]);
    await startPipeline('quality', {
      lessonsDir,
      sampleRate,
      budget,
      dryRun,
    });
  };

  if (lastResult?.success && lastResult.data && Array.isArray(lastResult.data) && results.length === 0) {
    setResults(lastResult.data as QualityResult[]);
  }

  const verdictToStatus = (verdict?: string): 'approved' | 'rejected' | 'revision_needed' | 'manual_review' | 'pending' => {
    switch (verdict) {
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      case 'revision_needed': return 'revision_needed';
      default: return 'pending';
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">🔍 品質檢查</h1>
      <p className="text-gray-500 text-sm mb-6">Stage 04：批量品質檢查 + Auto-fix + Sampling</p>

      {/* Config */}
      <div className="card mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">講稿目錄</label>
            <input
              type="text"
              value={lessonsDir}
              onChange={(e) => setLessonsDir(e.target.value)}
              className="input-field"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sampling Rate（每 N 堂強制人工審核）
              </label>
              <input
                type="number"
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value))}
                min={1}
                max={20}
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
                min={0.01}
                max={100}
                step={0.5}
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
            onClick={handleCheck}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? '⏳ 檢查中...' : '🔍 開始檢查'}
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

      {results.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">📊 結果</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.file} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{r.file}</span>
                  {r.verdict && <StatusChip status={verdictToStatus(r.verdict)} />}
                </div>
                <button
                  onClick={() => navigate(`/quality/${r.file.replace('.json', '')}`)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  報告 →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
