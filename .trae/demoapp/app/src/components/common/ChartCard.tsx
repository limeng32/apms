/**
 * ChartCard — 图表容器卡（design.md §7）
 * 头部 H3 + 右侧操作区；图表区统一 padding
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** 右侧操作（图例切换/时间范围/导出图标） */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 图表区高度（默认 auto） */
  bodyClassName?: string;
}

export default function ChartCard({ title, subtitle, actions, children, className, bodyClassName }: ChartCardProps) {
  return (
    <div className={cn('rounded-[14px] border border-line bg-white shadow-card', className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </div>
  );
}
