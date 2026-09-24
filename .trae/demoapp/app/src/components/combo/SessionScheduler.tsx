/**
 * SessionScheduler — 组合测试会话调度条（combo-testing.md §3）
 * 横向时间轴会话卡：点击过滤结果区；体能师可拖拽调整（演示弹簧吸附 + Toast）
 */

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Timer, CalendarClock, MoveHorizontal } from 'lucide-react';
import { StatusBadge } from '@/components/common';
import { COMBO_SESSIONS } from '@/data';
import type { ComboSession } from '@/data';
import { cn } from '@/lib/utils';

const STATUS_META: Record<ComboSession['status'], { tone: 'green' | 'blue' | 'amber'; label: string }> = {
  已完成: { tone: 'green', label: '已完成' },
  已排期: { tone: 'blue', label: '待进行' },
  待确认: { tone: 'amber', label: '待确认' },
};

function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${Number(m)}.${Number(day)}`;
}

interface SessionSchedulerProps {
  selectedId: string | null; // null = 全部
  onSelect: (id: string | null) => void;
  canDrag: boolean;
  onToast: (msg: string, kind?: 'success' | 'info' | 'warning') => void;
}

export default function SessionScheduler({ selectedId, onSelect, canDrag, onToast }: SessionSchedulerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="rounded-[14px] border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3 className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            本周组合测试会话
          </h3>
          <p className="mt-0.5 text-xs text-text-3">
            多工位轮转 · 点击会话卡过滤下方结果
            {canDrag && (
              <span className="ml-2 inline-flex items-center gap-1 text-brand-600">
                <MoveHorizontal className="h-3 w-3" />
                可拖拽调整时间（演示）
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => onSelect(null)}
          className={cn(
            'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
            selectedId === null
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-line bg-white text-text-2 hover:border-text-3',
          )}
        >
          全部会话
        </button>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto p-5">
        {COMBO_SESSIONS.map((s, i) => {
          const meta = STATUS_META[s.status];
          const active = selectedId === s.id;
          return (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut', delay: i * 0.06 }}
              drag={canDrag ? 'x' : false}
              dragConstraints={scrollRef}
              dragElastic={0.2}
              whileDrag={{ scale: 1.03, zIndex: 10 }}
              onDragEnd={() => canDrag && onToast('已调整会话时间（演示）', 'info')}
              onClick={() => onSelect(active ? null : s.id)}
              className={cn(
                'w-56 shrink-0 rounded-xl border bg-white p-4 text-left transition-all duration-150',
                active
                  ? 'border-brand-600 shadow-glowBlue'
                  : 'border-line hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-lift',
                canDrag && 'cursor-grab active:cursor-grabbing',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono-data text-[13px] font-semibold text-text-1">{s.id}</span>
                <StatusBadge tone={meta.tone} label={meta.label} pulse={false} />
              </div>
              <p className="mt-2 font-mono-data text-lg font-semibold leading-6 text-text-1">
                {fmtDate(s.date)} <span className="text-[13px] text-text-2">{s.time}</span>
              </p>
              <p className="mt-1 truncate text-xs text-text-2" title={s.group}>{s.group}</p>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[11px] text-text-3">{s.athleteIds.length} 人</span>
                <span className="flex items-center gap-1.5 text-text-3">
                  {s.devices.includes('测力台') && <Gauge className="h-3.5 w-3.5" aria-label="测力台" />}
                  {s.devices.includes('计时门') && <Timer className="h-3.5 w-3.5" aria-label="计时门" />}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
