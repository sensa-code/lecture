import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settings-store';

export function SettingsView() {
  const {
    apiKeys, isLoading, error,
    loadKeys, updateKey, saveKey, setKeyValidation,
  } = useSettingsStore();

  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleSave = async (name: string, value: string) => {
    setSavingKey(name);
    try {
      await saveKey(name, value);
      // Validate after save
      const result = await window.electronAPI.env.validate(name);
      setKeyValidation(name, result.valid, result.error);
    } finally {
      setSavingKey(null);
    }
  };

  const handleValidateAll = async () => {
    for (const key of apiKeys) {
      if (key.value) {
        const result = await window.electronAPI.env.validate(key.name);
        setKeyValidation(key.name, result.valid, result.error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          <span className="animate-spin inline-block mr-2">⏳</span>
          載入設定中...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">⚙️ 設定</h1>
          <p className="text-gray-500 text-sm mt-1">管理 API Keys 和偏好設定</p>
        </div>
        <button
          onClick={handleValidateAll}
          className="btn-secondary text-sm"
        >
          驗證全部
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ {error}
        </div>
      )}

      <div className="space-y-4">
        {apiKeys.map((key) => (
          <div key={key.name} className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {key.label}
              </label>
              {key.isValid === true && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">✅ 有效</span>
              )}
              {key.isValid === false && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  ❌ {key.error || '無效'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={key.value}
                onChange={(e) => updateKey(key.name, e.target.value)}
                placeholder={`輸入 ${key.label}...`}
                className="input-field flex-1 font-mono text-sm"
              />
              <button
                onClick={() => handleSave(key.name, key.value)}
                disabled={savingKey === key.name}
                className="btn-primary text-sm whitespace-nowrap"
              >
                {savingKey === key.name ? '儲存中...' : '儲存'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{key.name}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">💡 說明</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• API Keys 以加密方式儲存在本地電腦</li>
          <li>• 至少需要 Anthropic API Key 才能執行 AI 生成功能</li>
          <li>• HeyGen 和 ElevenLabs API Key 僅影片生成階段需要</li>
          <li>• Supabase Keys 僅在需要資料庫功能時需要</li>
        </ul>
      </div>
    </div>
  );
}
