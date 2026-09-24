/**
 * ProgressRing — SVG 环形进度（design.md §7）
 * 轨道 #EEF2F7，进度弧按状态取色，strokeDashoffset 900ms 动画，中心 Mono 百分比
 * ProgressBar — 细进度条（任务看板等）
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'green' | 'amber' | 'red' | 'blue';

const TONE_COLOR: Record<Tone, string> = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  blue: '#2563EB',
};

interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  /** 中心副文案 */
  label?: string;
  className?: string;
}

export function ProgressRing({ value, size = 96, stroke = 8, tone = 'blue', label, className }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
    if (reduced) {
      setOffset(target);
      return;
    }
    const t = setTimeout(() => setOffset(target), 150);
    return () => clearTimeout(t);
  }, [value, circumference]);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-data font-bold text-text-1 tnum" style={{ fontSize: size * 0.22 }}>
          {Math.round(value)}%
        </span>
        {label && <span className="text-[10px] text-text-3">{label}</span>}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  tone?: Tone;
  className?: string;
}

export function ProgressBar({ value, tone = 'blue', className }: ProgressBarProps) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#EEF2F7]', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: TONE_COLOR[tone] }}
      />
    </div>
  );
}
