import { useState } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import { useFileDialog } from '../hooks/useIPC';
import { JsonPreview } from '../components/JsonPreview';
import { ProgressBar } from '../components/ProgressBar';

export function SyllabusView() {
  const [courseName, setCourseName] = useState('');
  const [audience, setAudience] = useState('');
  const [coreValue, setCoreValue] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<unknown>(null);
  const [knowledgeFilePath, setKnowledgeFilePath] = useState('');
  const { isRunning, progress, lastResult, error, startPipeline, stopPipeline } = usePipeline();
  const { openFile, readJson } = useFileDialog();

  const isLoading = isRunning;

  const handleLoadKnowledge = async () => {
    const filePath = await openFile([{ name: 'JSON', extensions: ['json'] }]);
    if (!filePath) return;
    const result = await readJson(filePath);
    if (result.success && result.data) {
      setKnowledgeBase(result.data);
      setKnowledgeFilePath(filePath);
    }
  };

  const handleGenerate = async () => {
    if (!courseName.trim() || !audience.trim() || !coreValue.trim() || !knowledgeBase) return;
    await startPipeline('syllabus', { courseName, audience, coreValue, knowledgeBase });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">📋 課程大綱</h1>
      <p className="text-gray-500 text-sm mb-6">Stage 01：基於知識庫生成含 Bloom&#39;s Taxonomy 的課程大綱</p>

      <div className="card mb-6">
        {/* Knowledge base file */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">知識庫檔案</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={knowledgeFilePath}
              readOnly
              placeholder="選擇 knowledge-base.json..."
              className="input-field flex-1"
            />
            <button onClick={handleLoadKnowledge} className="btn-secondary whitespace-nowrap" disabled={isLoading}>
              📁 選擇檔案
            </button>
          </div>
          {knowledgeBase !== null && (
            <span className="text-xs text-green-600 mt-1 inline-block">✅ 已載入</span>
          )}
        </div>

        {/* Course info */}
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
              className="input-field"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">核心價值</label>
            <textarea
              value={coreValue}
              onChange={(e) => setCoreValue(e.target.value)}
              className="input-field min-h-[60px]"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !courseName.trim() || !knowledgeBase}
            className="btn-primary"
          >
            {isLoading ? '⏳ 生成中...' : '🚀 生成大綱'}
          </button>
          {isLoading && (
            <button onClick={stopPipeline} className="btn-danger">⏹ 停止</button>
          )}
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

      {lastResult?.success && lastResult.data !== undefined && lastResult.data !== null && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">📄 大綱結果</h2>
          <JsonPreview data={lastResult.data} title="Syllabus JSON" />
        </div>
      )}
    </div>
  );
}
