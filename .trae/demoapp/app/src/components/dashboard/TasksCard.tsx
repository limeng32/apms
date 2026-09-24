/**
 * TasksCard — 本周测试任务进度（dashboard.md §3.2）
 * 数据：activeTasks()/TEST_TASKS/taskProgress()；进度条 0→值 700ms 生长，stagger 0.08s
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { ChartCard, StatusBadge } from '@/components/common';
import type { StatusTone } from '@/components/common';
import { TEST_TASKS, activeTasks, taskProgress } from '@/data';
import type { TestTask } from '@/data';
import { cn } from '@/lib/utils';
import { BIG_CARD } from './theme';

function progressTone(t: TestTask): StatusTone {
  if (t.status === '未开始') return 'gray';
  const p = taskProgress(t);
  if (p >= 60) return 'green';
  if (p >= 40) return 'amber';
  return 'red';
}

function TaskRow({
  task,
  index,
  big,
  onOpen,
}: {
  task: TestTask;
  index: number;
  big?: boolean;
  onOpen: (t: TestTask) => void;
}) {
  const pct = taskProgress(task);
  const tone = progressTone(task);
  const pctColor =
    tone === 'green'
      ? 'text-ok'
      : tone === 'amber'
        ? 'text-warn'
        : tone === 'red'
          ? 'text-risk'
          : big
            ? 'text-white/50'
            : 'text-text-3';

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => onOpen(task)}
      className={cn(
        'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-100',
        big ? 'hover:bg-white/5' : 'hover:bg-[#F8FAFF]',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-semibold', big ? 'text-white' : 'text-text-1')}>
            {task.title}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-px text-[11px] leading-[16px]',
              big ? 'border-ink-700 bg-white/5 text-white/60' : 'border-line bg-slate-50 text-text-2',
            )}
          >
            {task.owner}
          </span>
          {task.status === '未开始' && <StatusBadge tone="gray" label="未开始" pulse={false} />}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className={cn('h-1.5 flex-1 overflow-hidden rounded-full', big ? 'bg-white/10' : 'bg-slate-100')}>
            <motion.div
              className="h-full rounded-full bg-btn-brand"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + index * 0.08 }}
            />
          </div>
          <span className={cn('shrink-0 font-mono-data text-xs tnum', big ? 'text-white/50' : 'text-text-3')}>
            {task.window}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn('font-mono-data text-[13px] font-semibold tnum', big ? 'text-white' : 'text-text-1')}>
          {task.tested}/{task.target}
        </span>
        <span className={cn('ml-2 font-mono-data text-[13px] font-semibold tnum', pctColor)}>{pct}%</span>
      </div>
    </motion.button>
  );
}

export default function TasksCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [showDone, setShowDone] = useState(false);
  const active = activeTasks();
  const done = TEST_TASKS.filter((t) => t.status === '已完成');

  return (
    <ChartCard
      title="本周测试任务进度"
      subtitle={`活跃任务 ${active.length} 项 · 点击行查看任务`}
      className={cn(className, big && BIG_CARD)}
      bodyClassName="py-3"
    >
      <div className="flex flex-col gap-0.5">
        {active.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i} big={big} onOpen={(task) => navigate(`/testing?task=${task.id}`)} />
        ))}
      </div>

      {/* 已完成折叠 */}
      <button
        onClick={() => setShowDone((v) => !v)}
        className={cn(
          'mt-1 flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-xs transition-colors',
          big ? 'text-white/50 hover:bg-white/5' : 'text-text-3 hover:bg-slate-50',
        )}
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', showDone && 'rotate-180')} />
        已完成 {done.length} 项
      </button>
      <AnimatePresence initial={false}>
        {showDone && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-2.5 py-1.5">
                <span className={cn('flex-1 truncate text-sm line-through', big ? 'text-white/40' : 'text-text-3')}>
                  {t.title}
                </span>
                <span className={cn('font-mono-data text-xs tnum', big ? 'text-white/40' : 'text-text-3')}>
                  {t.window}
                </span>
                <StatusBadge tone="green" label={`${t.tested}/${t.target}`} pulse={false} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('mt-2 flex justify-end border-t pt-3', big ? 'border-ink-700' : 'border-line')}>
        <button
          onClick={() => navigate('/testing')}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
        >
          查看全部任务
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </ChartCard>
  );
}
