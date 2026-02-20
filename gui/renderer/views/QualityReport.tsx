import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileDialog } from '../hooks/useIPC';
import { StatusChip } from '../components/StatusChip';
import { JsonPreview } from '../components/JsonPreview';

interface QualityIssue {
  severity: string;
  category: string;
  description: string;
  segment_id?: string;
  suggestion?: string;
}

interface ReportData {
  verdict: string;
  overall_score: number;
  score_breakdown?: Record<string, number>;
  issues: QualityIssue[];
  forcedManualReview?: boolean;
  rounds?: number;
}

export function QualityReport() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { readJson } = useFileDialog();
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await readJson(`output/reports/${lessonId}-report.json`);
        if (result.success && result.data) {
          setReport(result.data as ReportData);
        } else {
          setError(result.error || 'Report not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    if (lessonId) load();
  }, [lessonId, readJson]);

  if (isLoading) {
    return <div className="text-gray-500">⏳ 載入中...</div>;
  }

  if (error) {
    return (
      <div>
        <button onClick={() => navigate('/quality')} className="text-primary-600 hover:underline mb-4 text-sm">← 返回列表</button>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">❌ {error}</div>
      </div>
    );
  }

  if (!report) {
    return <div className="text-gray-500">找不到報告</div>;
  }

  const verdictStatus = report.verdict === 'approved' ? 'approved' :
    report.verdict === 'rejected' ? 'rejected' : 'revision_needed';

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/quality')} className="text-primary-600 hover:underline mb-4 text-sm">← 返回列表</button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">品質報告</h1>
        <StatusChip status={verdictStatus} size="md" />
        {report.forcedManualReview && <StatusChip status="manual_review" size="md" />}
      </div>

      <p className="text-gray-500 text-sm font-mono mb-6">{lessonId}</p>

      {/* Score */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">📊 分數</h2>
        <div className="text-4xl font-bold mb-2">{report.overall_score.toFixed(1)}</div>
        <div className="text-sm text-gray-500">/ 100</div>

        {report.score_breakdown && (
          <div className="mt-4 space-y-2">
            {Object.entries(report.score_breakdown).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-600">{key}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        )}

        {report.rounds && (
          <div className="mt-3 text-xs text-gray-400">Auto-fix 輪次: {report.rounds}</div>
        )}
      </div>

      {/* Issues */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">⚠️ Issues ({report.issues.length})</h2>
        {report.issues.length === 0 ? (
          <p className="text-gray-500 text-sm">無問題 🎉</p>
        ) : (
          <div className="space-y-3">
            {report.issues.map((issue, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                    issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{issue.severity}</span>
                  <span className="text-xs text-gray-400">{issue.category}</span>
                  {issue.segment_id && <span className="text-xs font-mono text-gray-400">{issue.segment_id}</span>}
                </div>
                <p className="text-sm">{issue.description}</p>
                {issue.suggestion && (
                  <p className="text-xs text-gray-500 mt-1">💡 {issue.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <JsonPreview data={report} title="完整報告 JSON" />
    </div>
  );
}
