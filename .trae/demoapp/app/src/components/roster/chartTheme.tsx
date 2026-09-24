/**
 * chartTheme.tsx — 本组页面共享的深色图表 Tooltip（design.md §8）
 * 样式常量见 chartConsts.ts
 */

import type { ReactNode } from 'react';

/** 深色图表 Tooltip 容器 */
export function DarkTooltip({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      {title && <p className="mb-1 font-mono-data text-[11px] text-slate-400">{title}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ color, name, value, dash }: { color: string; name: string; value: string; dash?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, opacity: dash ? 0.55 : 1, outline: dash ? `1px dashed ${color}` : 'none' }}
      />
      <span className="text-slate-300">{name}</span>
      <span className="ml-auto pl-3 font-mono-data font-semibold tnum">{value}</span>
    </div>
  );
}
