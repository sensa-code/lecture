import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnv } from '../hooks/useIPC';

interface StageCard {
  stage: string;
  label: string;
  icon: string;
  description: string;
  path: string;
}

const stages: StageCard[] = [
  {
    stage: '00',
    label: '知識深挖',
    icon: '🔬',
    description: '輸入課程主題，生成 7 面向知識庫',
    path: '/knowledge',
  },
  {
    stage: '01',
    label: '課程大綱',
    icon: '📋',
    description: '基於知識庫生成含 Bloom 分級的大綱',
    path: '/syllabus',
  },
  {
    stage: '02-03',
    label: '講稿生成',
    icon: '📝',
    description: '批量生成講稿和案例對話',
    path: '/lessons',
  },
  {
    stage: '04',
    label: '品質檢查',
    icon: '🔍',
    description: '自動品質檢查 + Auto-fix + Sampling',
    path: '/quality',
  },
  {
    stage: '06',
    label: '影片生成',
    icon: '🎬',
    description: 'HeyGen 數位人 + ElevenLabs TTS',
    path: '/video',
  },
];

const requiredKeys = [
  { key: 'ANTHROPIC_API_KEY', label: 'Claude API', stages: '00-04' },
  { key: 'SUPABASE_URL', label: 'Supabase URL', stages: '04-05' },
  { key: 'SUPABASE_KEY', label: 'Supabase Key', stages: '04-05' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Admin', stages: '04-05' },
  { key: 'HEYGEN_API_KEY', label: 'HeyGen', stages: '06' },
  { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs', stages: '06' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { getAllKeys } = useEnv();
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>({});
  const [isCheckingKeys, setIsCheckingKeys] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkKeys() {
      try {
        const keys = await getAllKeys();
        if (cancelled) return;
        const configured: Record<string, boolean> = {};
        for (const k of requiredKeys) {
          configured[k.key] = Boolean(keys[k.key] && keys[k.key].length > 0);
        }
        setConfiguredKeys(configured);
      } catch {
        // Keys not available yet
      } finally {
        if (!cancelled) setIsCheckingKeys(false);
      }
    }
    checkKeys();
    return () => { cancelled = true; };
  }, [getAllKeys]);

  const configuredCount = Object.values(configuredKeys).filter(Boolean).length;
  const totalKeys = requiredKeys.length;
  const allConfigured = configuredCount === totalKeys;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">📊 總覽</h1>
        <p className="text-gray-500 mt-2">獸醫課程 AI 生成系統 — 8 階段流水線</p>
      </div>

      {/* Status banner */}
      {isCheckingKeys ? (
        <div className="card mb-6 bg-gray-50">
          <p className="text-gray-500 text-sm">⏳ 檢查系統狀態...</p>
        </div>
      ) : allConfigured ? (
        <div className="card mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h2 className="font-semibold text-green-800">系統就緒</h2>
              <p className="text-sm text-green-600">所有 API Keys 已配置（{configuredCount}/{totalKeys}），可以開始生成課程</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="font-semibold text-yellow-800">需要配置 API Keys</h2>
              <p className="text-sm text-yellow-600">
                已配置 {configuredCount}/{totalKeys} 個 Keys。
                缺少：{requiredKeys.filter(k => !configuredKeys[k.key]).map(k => k.label).join('、')}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* API Key status */}
      {!isCheckingKeys && !allConfigured && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-3">🔑 API Key 狀態</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {requiredKeys.map(k => (
              <div key={k.key} className="flex items-center gap-2 text-sm">
                <span className={configuredKeys[k.key] ? 'text-green-500' : 'text-red-400'}>
                  {configuredKeys[k.key] ? '✅' : '❌'}
                </span>
                <span className="text-gray-700">{k.label}</span>
                <span className="text-xs text-gray-400">({k.stages})</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
