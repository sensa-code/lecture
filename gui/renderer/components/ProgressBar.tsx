interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ current, total, label, showPercentage = true }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label || `${current} / ${total}`}</span>
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-600 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
