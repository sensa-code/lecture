import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileDialog } from '../hooks/useIPC';
import { JsonPreview } from '../components/JsonPreview';

interface Segment {
  segment_id: string;
  type: string;
  speaker_mode?: string;
  visual_type?: string;
  script_zh?: string;
  duration_seconds: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  bloom_level?: string;
}

interface LessonData {
  lesson_id: string;
  title: string;
  segments: Segment[];
  quiz?: QuizQuestion[];
}

export function LessonDetail() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { readJson } = useFileDialog();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await readJson(`output/lessons/${lessonId}.json`);
        if (result.success && result.data) {
          setLesson(result.data as LessonData);
        } else {
          setError(result.error || 'Failed to load lesson');
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
        <button onClick={() => navigate('/lessons')} className="text-primary-600 hover:underline mb-4 text-sm">← 返回列表</button>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">❌ {error}</div>
      </div>
    );
  }

  if (!lesson) {
    return <div className="text-gray-500">找不到課程 {lessonId}</div>;
  }

  const totalDuration = lesson.segments.reduce((sum, s) => sum + s.duration_seconds, 0);

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/lessons')} className="text-primary-600 hover:underline mb-4 text-sm">← 返回列表</button>

      <h1 className="text-2xl font-bold mb-1">{lesson.title}</h1>
      <p className="text-gray-500 text-sm mb-6 font-mono">{lesson.lesson_id}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold">{lesson.segments.length}</div>
          <div className="text-sm text-gray-500">Segments</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">{Math.round(totalDuration / 60)}分</div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">{lesson.quiz?.length || 0}</div>
          <div className="text-sm text-gray-500">Quiz</div>
        </div>
      </div>

      {/* Segments */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">📑 Segments</h2>
        <div className="space-y-3">
          {lesson.segments.map((segment) => (
            <div key={segment.segment_id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{segment.segment_id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    segment.type === 'opening' ? 'bg-blue-100 text-blue-700' :
                    segment.type === 'teaching' ? 'bg-green-100 text-green-700' :
                    segment.type === 'case' ? 'bg-purple-100 text-purple-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>{segment.type}</span>
                  {segment.visual_type && (
                    <span className="text-xs text-gray-400">{segment.visual_type}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{segment.duration_seconds}s</span>
              </div>
              {segment.script_zh && (
                <p className="text-sm text-gray-700 mt-1 line-clamp-2">{segment.script_zh}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quiz */}
      {lesson.quiz && lesson.quiz.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-3">❓ 測驗題</h2>
          <div className="space-y-4">
            {lesson.quiz.map((q, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-sm mb-2">Q{i + 1}: {q.question}</p>
                <ul className="space-y-1">
                  {q.options.map((opt, j) => (
                    <li key={j} className={`text-sm pl-4 ${j === q.correct_answer ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                      {j === q.correct_answer ? '✅' : '○'} {opt}
                    </li>
                  ))}
                </ul>
                {q.bloom_level && (
                  <span className="text-xs text-gray-400 mt-1 inline-block">Bloom: {q.bloom_level}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON */}
      <JsonPreview data={lesson} title="完整 JSON" />
    </div>
  );
}
