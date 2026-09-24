/**
 * DashKpiCard — 驾驶舱 KPI 卡（dashboard.md §2）
 * 基于公共 KpiCard 的版式扩展：迷你 sparkline（80×28 Recharts Line，无轴）、
 * 状态脉冲点、大屏模式深色变体（发光状态点 + 数字加大 20%）
 */

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Line, LineChart } from 'recharts';
import { useCountUp } from '@/components/common';
import { cn } from '@/lib/utils';

export type ChipTone = 'up-good' | 'down-good' | 'up-warn' | 'flat' | 'info';

interface DashKpiCardProps {
  title: string;
  value: number;
  unit?: string;
  decimals?: number;
  /** 顶部 4px 色条 */
  accent: string;
  /** 环比文案（如 "+8%"、"-1"、"+0.06"、"+2 本学期"、"持平"） */
  chip?: string;
  chipTone?: ChipTone;
  /** 迷你 sparkline（近 8 周） */
  spark?: number[];
  sparkColor?: string;
  /** 数值旁状态脉冲点（红预警） */
  pulseDot?: boolean;
  /** 点击（如 K4 → /health 红色过滤） */
  onClick?: () => void;
  /** 大屏模式深色变体 */
  big?: boolean;
}

const CHIP_STYLE: Record<ChipTone, { light: string; dark: string }> = {
  'up-good': { light: 'bg-ok-bg text-ok', dark: 'bg-ok/15 text-[#4ADE80]' },
  'down-good': { light: 'bg-ok-bg text-ok', dark: 'bg-ok/15 text-[#4ADE80]' },
  'up-warn': { light: 'bg-warn-bg text-warn', dark: 'bg-warn/15 text-[#FBBF24]' },
  flat: { light: 'bg-slate-100 text-text-2', dark: 'bg-white/10 text-white/60' },
  info: { light: 'bg-brand-50 text-brand-600', dark: 'bg-brand-600/20 text-[#93C5FD]' },
};

export default function DashKpiCard({
  title,
  value,
  unit,
  decimals = 0,
  accent,
  chip,
  chipTone = 'flat',
  spark,
  sparkColor = '#3B82F6',
  pulseDot,
  onClick,
  big,
}: DashKpiCardProps) {
  const display = useCountUp(value, 900, decimals);
  const sparkData = useMemo(() => spark?.map((v, i) => ({ i, v })), [spark]);
  const chipIcon =
    chipTone === 'up-good' || chipTone === 'up-warn' ? (
      <ArrowUpRight className="h-3 w-3" />
    ) : chipTone === 'down-good' ? (
      <ArrowDownRight className="h-3 w-3" />
    ) : chipTone === 'flat' ? (
      <Minus className="h-3 w-3" />
    ) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-[14px] border p-5 transition-all duration-150',
        big
          ? 'border-ink-700 bg-ink-800 shadow-glowBlue'
          : 'border-line bg-white shadow-card hover:-translate-y-0.5 hover:shadow-lift',
        onClick && 'cursor-pointer',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      {/* 大屏模式左上发光状态点 */}
      {big && (
        <span
          className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px 2px ${accent}66` }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-xs', big ? 'text-white/50' : 'text-text-3')}>{title}</p>
          <p
            className={cn(
              'mt-2 font-mono-data font-bold tnum',
              big ? 'text-4xl leading-[46px] text-white' : 'text-kpi text-text-1',
            )}
          >
            {display}
            {unit && (
              <span className={cn('ml-1 text-sm font-medium', big ? 'text-white/50' : 'text-text-3')}>
                {unit}
              </span>
            )}
            {pulseDot && (
              <span className="relative ml-2 inline-flex h-2.5 w-2.5 align-middle">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-risk" />
              </span>
            )}
          </p>
        </div>
        {sparkData && (
          <div className="mt-1 shrink-0">
            <LineChart width={80} height={28} data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
            </LineChart>
          </div>
        )}
      </div>
      {chip && (
        <div className="mt-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono-data text-[11px] font-semibold',
              big ? CHIP_STYLE[chipTone].dark : CHIP_STYLE[chipTone].light,
            )}
          >
            {chipIcon}
            {chip}
          </span>
        </div>
      )}
    </div>
  );
}
