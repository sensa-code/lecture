import { useState } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import { JsonPreview } from '../components/JsonPreview';
import { ProgressBar } from '../components/ProgressBar';

export function KnowledgeView() {
  const [courseName, setCourseName] = useState('');
  const [audience, setAudience] = useState('');
  const [coreValue, setCoreValue] = useState('');
  const { isRunning, progress, lastResult, error, startPipeline, stopPipeline } = usePipeline();

  const isLoading = isRunning;

  const handleGenerate = async () => {
    if (!courseName.trim() || !audience.trim() || !coreValue.trim()) return;
    await startPipeline('knowledge', { courseName, audience, coreValue });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">🔬 知識深挖</h1>
      <p className="text-gray-500 text-sm mb-6">Stage 00：輸入課程主題，生成 7 面向知識庫</p>

      {/* Input form */}
      <div className="card mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱</label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="例：獸醫師溝通話術完全攻略"
              className="input-field"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目標受眾</label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="例：執業獸醫師"
              className="input-field"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">核心價值</label>
            <textarea
              value={coreValue}
              onChange={(e) => setCoreValue(e.target.value)}
              placeholder="例：提升獸醫師與飼主的溝通效率，減少醫療糾紛"
              className="input-field min-h-[80px]"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !courseName.trim() || !audience.trim() || !coreValue.trim()}
            className="btn-primary"
          >
            {isLoading ? '⏳ 生成中...' : '🚀 開始生成'}
          </button>
          {isLoading && (
            <button onClick={stopPipeline} className="btn-danger">
              ⏹ 停止
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isLoading && progress !== null && (
        <div className="card mb-6">
          <ProgressBar
            current={progress.current}
            total={progress.total}
            label={progress.message}
          />
        </div>
      )}

      {/* Error */}
      {error !== null && error !== '' && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {lastResult !== null && lastResult.success === true && lastResult.data !== undefined && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">📄 生成結果</h2>
          <JsonPreview data={lastResult.data} title="Knowledge Base JSON" />
        </div>
      )}
    </div>
  );
}
