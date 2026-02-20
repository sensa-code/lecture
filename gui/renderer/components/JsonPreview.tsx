import { useState } from 'react';

interface JsonPreviewProps {
  data: unknown;
  title?: string;
  maxHeight?: string;
  collapsible?: boolean;
}

export function JsonPreview({
  data,
  title,
  maxHeight = '400px',
  collapsible = true,
}: JsonPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {title && (
        <button
          onClick={() => collapsible && setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <span>{title}</span>
          {collapsible && (
            <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
          )}
        </button>
      )}
      {(isExpanded || !collapsible) && (
        <pre
          className="p-4 text-xs font-mono text-gray-700 bg-white overflow-auto"
          style={{ maxHeight }}
        >
          {jsonString}
        </pre>
      )}
    </div>
  );
}
