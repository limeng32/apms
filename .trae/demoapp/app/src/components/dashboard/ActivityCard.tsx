/**
 * ActivityCard — 实时动态（dashboard.md §5.2）
 * 竖向时间线（左 2px 竖线 + 状态点），数据：NOTIFICATIONS；hover 微移 2px，点击跳对应模块
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ChartCard, useToast } from '@/components/common';
import { NOTIFICATIONS } from '@/data';
import type { NotificationLevel } from '@/data';
import { cn } from '@/lib/utils';
import { BIG_CARD, STATUS } from './theme';

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  red: STATUS.red,
  amber: STATUS.amber,
  green: STATUS.green,
  blue: '#2563EB',
};

export default function ActivityCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <ChartCard
      title="实时动态"
      className={cn(className, big && BIG_CARD)}
      bodyClassName="pt-4"
      actions={
        <button
          onClick={() => toast('通知中心为演示占位（demo）', 'info')}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
        >
          全部通知
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="relative flex flex-col">
        {/* 2px 竖线 */}
        <span
          className={cn('absolute bottom-2 left-[5px] top-2 w-0.5 rounded-full', big ? 'bg-ink-700' : 'bg-line')}
        />
        {NOTIFICATIONS.map((n) => (
          <button
            key={n.id}
            onClick={() => (n.link ? navigate(n.link) : undefined)}
            className={cn(
              'group relative flex items-start gap-3 rounded-lg py-2 pl-0 pr-1 text-left transition-all duration-100',
              'hover:translate-x-0.5',
              big ? 'hover:bg-white/5' : 'hover:bg-[#F8FAFF]',
            )}
          >
            <span className="relative z-10 ml-0 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
              {n.level === 'red' && (
                <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-50 motion-reduce:hidden" style={{ background: LEVEL_COLOR.red }} />
              )}
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{
                  background: LEVEL_COLOR[n.level],
                  boxShadow: `0 0 0 2px ${big ? '#111B31' : '#FFFFFF'}`,
                }}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[13px] leading-[20px]', big ? 'text-white/85' : 'text-text-1')}>
                {n.title}
              </span>
              <span className={cn('mt-0.5 block font-mono-data text-[11px]', big ? 'text-white/40' : 'text-text-3')}>
                {n.time}
              </span>
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
