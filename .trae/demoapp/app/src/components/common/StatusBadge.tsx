/**
 * StatusBadge — 红黄绿三态 pill（design.md §7）
 * 12px 字 + 6px 状态点 + 对应 bg/border；红状态带脉冲动画
 */

import { cn } from '@/lib/utils';

export type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

const TONE_STYLE: Record<StatusTone, { bg: string; border: string; text: string; dot: string }> = {
  green: { bg: '#E8F7EE', border: '#B7E4C7', text: '#16A34A', dot: '#16A34A' },
  amber: { bg: '#FEF3E0', border: '#F5D9A8', text: '#D97706', dot: '#D97706' },
  red: { bg: '#FCEBEB', border: '#F3C1C1', text: '#DC2626', dot: '#DC2626' },
  blue: { bg: '#EFF5FF', border: '#BFDBFE', text: '#2563EB', dot: '#2563EB' },
  gray: { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', dot: '#94A3B8' },
};

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  /** 红状态脉冲（预警场景） */
  pulse?: boolean;
  className?: string;
}

export default function StatusBadge({ tone, label, pulse, className }: StatusBadgeProps) {
  const s = TONE_STYLE[tone];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-[18px]', className)}
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {(pulse ?? tone === 'red') && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
            style={{ background: s.dot }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      </span>
      {label}
    </span>
  );
}
