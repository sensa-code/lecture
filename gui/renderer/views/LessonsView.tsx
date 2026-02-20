import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePipeline } from '../hooks/usePipeline';
import { useFileDialog } from '../hooks/useIPC';
import { ProgressBar } from '../components/ProgressBar';
import { CostBadge } from '../components/CostBadge';

export function LessonsView() {
  const navigate = useNavigate();
  const [syllabusPath, setSyllabusPath] = useState('');
  const [syllabusData, setSyllabusData] = useState<unknown>(null);
  const [courseId, setCourseId] = useState('');
  const [budget, setBudget] = useState(5);
  const [dryRun, setDryRun] = useState(false);
  const [results, setResults] = useState<Array<{ lesson_id: string; status: string; path?: string }>>([]);
  const { isRunning, progress, lastResult, error, startPipeline, stopPipeline } = usePipeline();
  const { openFile, readJson } = useFileDialog();

  const isLoading = isRunning;

  const handleLoadSyllabus = async () => {
    const filePath = await openFile([{ name: 'JSON', extensions: ['json'] }]);
    if (!filePath) return;
    const result = await readJson(filePath);
    if (result.success && result.data) {
      setSyllabusData(result.data);
      setSyllabusPath(filePath);
    }
  };

  const handleGenerate = async () => {
    if (!syllabusData) return;
    setResults([]);
    await startPipeline('lessons', {
      syllabus: syllabusData,
      courseId: courseId || undefined,
      budget,
      dryRun,
    });
  };

  // Update results when pipeline completes
  if (lastResult?.success && lastResult.data && Array.isArray(lastResult.data) && results.length === 0) {
    setResults(lastResult.data as Array<{ lesson_id: string; status: string; path?: string }>);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">📝 講稿生成</h1>
      <p className="text-gray-500 text-sm mb-6">Stage 02-03：批量生成講稿和案例對話</p>

      {/* Config */}
      <div className="card mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">大綱檔案</label>
            <div className="flex gap-2">
              <input type="text" value={syllabusPath} readOnly placeholder="選擇 syllabus.json..." className="input-field flex-1" />
              <button onClick={handleLoadSyllabus} className="btn-secondary whitespace-nowrap" disabled={isLoading}>📁 選擇</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course ID（選填）</label>
              <input
                type="text"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                placeholder="例：vet-comm-001"
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
            onClick={handleGenerate}
            disabled={isLoading || !syllabusData}
            className="btn-primary"
          >
            {isLoading ? '⏳ 生成中...' : '🚀 批量生成'}
          </button>
          {isLoading && (
            <button onClick={stopPipeline} className="btn-danger">⏹ 停止</button>
          )}
          <CostBadge spent={0} budget={budget} />
        </div>
      </div>

      {/* Progress */}
      {isLoading && progress && (
        <div className="card mb-6">
          <ProgressBar current={progress.current} total={progress.total} label={progress.message} />
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">❌ {error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">📊 結果</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.lesson_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-mono text-sm">{r.lesson_id}</span>
                  <span className={`ml-2 text-xs ${r.status === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                    {r.status === 'success' ? '✅' : r.status === 'dry-run' ? '🏃' : '❌'} {r.status}
                  </span>
                </div>
                {r.status === 'success' && (
                  <button
                    onClick={() => navigate(`/lessons/${r.lesson_id}`)}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    查看 →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
