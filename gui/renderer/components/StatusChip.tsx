type Status = 'pending' | 'running' | 'approved' | 'rejected' | 'manual_review' | 'revision_needed' | 'error';

interface StatusChipProps {
  status: Status;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<Status, { label: string; icon: string; className: string }> = {
  pending: {
    label: '待處理',
    icon: '⏳',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  running: {
    label: '執行中',
    icon: '🔄',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  approved: {
    label: '通過',
    icon: '✅',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  rejected: {
    label: '拒絕',
    icon: '❌',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  manual_review: {
    label: '人工審核',
    icon: '🔎',
    className: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  revision_needed: {
    label: '需修改',
    icon: '✏️',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  error: {
    label: '錯誤',
    icon: '⚠️',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
};

export function StatusChip({ status, size = 'sm' }: StatusChipProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.className} ${sizeClass}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
