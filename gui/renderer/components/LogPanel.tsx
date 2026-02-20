import { useState, useEffect, useRef } from 'react';
import type { LogData } from '../../types/electron';

const LOG_LEVEL_STYLES: Record<string, string> = {
  info: 'text-gray-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LOG_LEVEL_ICONS: Record<string, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

export function LogPanel() {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to log messages
  useEffect(() => {
    const cleanup = window.electronAPI.log.onMessage((data: LogData) => {
      setLogs(prev => {
        const newLogs = [...prev, data];
        // Keep max 500 logs to prevent memory issues
        return newLogs.length > 500 ? newLogs.slice(-500) : newLogs;
      });
    });
    return cleanup;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.level === filter);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className={`border-t border-gray-200 bg-gray-900 transition-all duration-300 ${isExpanded ? 'h-64' : 'h-10'}`}>
      {/* Header bar */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span>{isExpanded ? '▼' : '▲'} 日誌</span>
          <span className="text-xs text-gray-500">{logs.length} 筆</span>
          {errorCount > 0 && (
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{errorCount} 錯誤</span>
          )}
          {warnCount > 0 && (
            <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full">{warnCount} 警告</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-1"
              >
                <option value="all">全部</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); setLogs([]); }}
                className="text-xs text-gray-500 hover:text-gray-300 px-2"
              >
                清除
              </button>
            </>
          )}
        </div>
      </button>

      {/* Log content */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="h-[calc(100%-2.5rem)] overflow-y-auto px-4 py-2 font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">暫無日誌</div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className={`flex gap-2 py-0.5 ${LOG_LEVEL_STYLES[log.level] || 'text-gray-300'}`}>
                <span className="flex-shrink-0 opacity-50">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="flex-shrink-0">{LOG_LEVEL_ICONS[log.level] || ''}</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
