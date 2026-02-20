import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  stage?: string;
}

const navItems: NavItem[] = [
  { path: '/', label: '總覽', icon: '📊' },
  { path: '/knowledge', label: '知識深挖', icon: '🔬', stage: '00' },
  { path: '/syllabus', label: '課程大綱', icon: '📋', stage: '01' },
  { path: '/lessons', label: '講稿生成', icon: '📝', stage: '02' },
  { path: '/quality', label: '品質檢查', icon: '🔍', stage: '04' },
  { path: '/video', label: '影片生成', icon: '🎬', stage: '06' },
  { path: '/settings', label: '設定', icon: '⚙️' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold">🐾 獸醫課程</h1>
        <p className="text-xs text-gray-400 mt-1">AI 生成系統 v1.0</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex flex-col items-start">
                <span>{item.label}</span>
                {item.stage && (
                  <span className="text-xs opacity-60">Stage {item.stage}</span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Version */}
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
        Electron GUI v1.0
      </div>
    </aside>
  );
}
