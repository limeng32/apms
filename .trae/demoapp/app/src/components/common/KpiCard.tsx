/**
 * KpiCard — 驾驶舱 KPI 卡（design.md §7）
 * 白卡：左上 12px 灰标题 + 30px Mono 大数字（count-up 动画）+ 右下环比 chip + 可选 4px 彩色顶条
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** count-up 数值（prefers-reduced-motion 时直接显示终值） */
export function useCountUp(target: number, duration = 900, decimals = 0): string {
  const [display, setDisplay] = useState(target.toFixed(decimals));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(target.toFixed(decimals));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay((target * easeOutQuart(t)).toFixed(decimals));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  return display;
}

interface KpiCardProps {
  title: string;
  value: number;
  unit?: string;
  decimals?: number;
  /** 环比（%），正上升负下降 */
  delta?: number;
  /** 环比是否"上升为好"（决定红绿） */
  deltaGoodWhenUp?: boolean;
  /** 顶部 4px 彩色条 */
  accent?: string;
  /** 副说明 */
  hint?: string;
  className?: string;
}

export default function KpiCard({
  title,
  value,
  unit,
  decimals = 0,
  delta,
  deltaGoodWhenUp = true,
  accent,
  hint,
  className,
}: KpiCardProps) {
  const display = useCountUp(value, 900, decimals);
  const deltaUp = (delta ?? 0) >= 0;
  const deltaGood = deltaUp === deltaGoodWhenUp;

  return (
    <div className={cn('relative overflow-hidden rounded-[14px] border border-line bg-white p-5 shadow-card', className)}>
      {accent && <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
      <p className="text-xs text-text-3">{title}</p>
      <p className="mt-2 font-mono-data text-[30px] font-bold leading-[38px] text-text-1 tnum">
        {display}
        {unit && <span className="ml-1 text-sm font-medium text-text-3">{unit}</span>}
      </p>
      <div className="mt-1 flex items-center justify-between">
        {hint ? <span className="text-xs text-text-3">{hint}</span> : <span />}
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono-data text-[11px] font-semibold',
              deltaGood ? 'bg-ok-bg text-ok' : 'bg-risk-bg text-risk',
            )}
          >
            {deltaUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}
