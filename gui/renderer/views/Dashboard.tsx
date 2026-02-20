import { useNavigate } from 'react-router-dom';

interface StageCard {
  stage: string;
  label: string;
  icon: string;
  description: string;
  path: string;
  status: 'ready' | 'not-configured';
}

const stages: StageCard[] = [
  {
    stage: '00',
    label: '知識深挖',
    icon: '🔬',
    description: '輸入課程主題，生成 7 面向知識庫',
    path: '/knowledge',
    status: 'ready',
  },
  {
    stage: '01',
    label: '課程大綱',
    icon: '📋',
    description: '基於知識庫生成含 Bloom 分級的大綱',
    path: '/syllabus',
    status: 'ready',
  },
  {
    stage: '02-03',
    label: '講稿生成',
    icon: '📝',
    description: '批量生成講稿和案例對話',
    path: '/lessons',
    status: 'ready',
  },
  {
    stage: '04',
    label: '品質檢查',
    icon: '🔍',
    description: '自動品質檢查 + Auto-fix + Sampling',
    path: '/quality',
    status: 'ready',
  },
  {
    stage: '06',
    label: '影片生成',
    icon: '🎬',
    description: 'HeyGen 數位人 + ElevenLabs TTS',
    path: '/video',
    status: 'ready',
  },
];

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">📊 總覽</h1>
        <p className="text-gray-500 mt-2">獸醫課程 AI 生成系統 — 8 階段流水線</p>
      </div>

      {/* Status banner */}
      <div className="card mb-6 bg-green-50 border-green-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h2 className="font-semibold text-green-800">系統就緒</h2>
            <p className="text-sm text-green-600">請先到設定頁面配置 API Keys，然後開始生成課程</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">快速操作</h2>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/knowledge')}
            className="btn-primary"
          >
            🚀 開始新課程
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="btn-secondary"
          >
            ⚙️ 設定 API Keys
          </button>
        </div>
      </div>

      {/* Stage cards */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">生成階段</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stages.map((s) => (
            <button
              key={s.stage}
              onClick={() => navigate(s.path)}
              className="card text-left hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <h3 className="font-semibold">{s.label}</h3>
                  <span className="text-xs text-gray-400">Stage {s.stage}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold mb-2">📚 資料流</h3>
        <p className="text-sm text-gray-600">
          知識深挖 → 大綱生成 → 講稿撰寫 → 品質檢查 → 影片生成
        </p>
        <p className="text-xs text-gray-400 mt-2">
          CLI v3.0 | 158 測試通過 | SSOT 架構
        </p>
      </div>
    </div>
  );
}
