interface CostBadgeProps {
  spent: number;
  budget: number;
  currency?: string;
}

export function CostBadge({ spent, budget, currency = 'USD' }: CostBadgeProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = percentage >= 100;
  const isNearBudget = percentage >= 80;

  const colorClass = isOverBudget
    ? 'bg-red-100 text-red-700 border-red-200'
    : isNearBudget
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-green-100 text-green-700 border-green-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border ${colorClass}`}>
      💰 ${spent.toFixed(2)} / ${budget.toFixed(2)} {currency}
    </span>
  );
}
