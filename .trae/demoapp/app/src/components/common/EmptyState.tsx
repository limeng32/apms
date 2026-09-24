/**
 * EmptyState — 空态（empty-state.svg + 灰字 + 主按钮）
 */

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  title = '暂无数据',
  desc = '当前筛选条件下没有匹配的记录',
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-14 text-center', className)}>
      <img src="/empty-state.svg" alt="" className="h-[120px] w-[160px] opacity-80" />
      <p className="mt-4 text-sm font-medium text-text-2">{title}</p>
      <p className="mt-1 text-xs text-text-3">{desc}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 h-9 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
