/**
 * DashTooltip — 全站统一图表 Tooltip（design.md §8）
 * 深色 #0F172A 圆角 10px 浮层，白字，状态点 + Mono 数值
 */

import type { ReactNode } from 'react';

export interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface DashTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  /** 格式化每行（默认 name: value） */
  formatter?: (item: TooltipPayloadItem) => { name: string; value: string; color?: string };
  /** 标题行覆盖 */
  title?: (label: string | number | undefined, payload?: TooltipPayloadItem[]) => ReactNode;
}

export default function DashTooltip({ active, label, payload, formatter, title }: DashTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <div className="mb-1 font-medium text-white/90">
        {title ? title(label, payload) : label}
      </div>
      <div className="flex flex-col gap-1">
        {payload.map((item, i) => {
          const row = formatter
            ? formatter(item)
            : { name: String(item.name ?? ''), value: String(item.value ?? ''), color: item.color };
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: row.color ?? item.color ?? '#3B82F6' }}
              />
              <span className="text-white/70">{row.name}</span>
              <span className="ml-auto font-mono-data font-semibold tnum">{row.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
