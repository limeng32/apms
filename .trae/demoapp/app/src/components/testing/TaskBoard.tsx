/**
 * TaskBoard — 任务进度看板（testing.md §4）
 * 状态过滤 chip + 排序 + 任务卡网格（进度条/未测名单/催办/审批）+ Drawer 明细
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, ShieldCheck, UserRound } from 'lucide-react';
import { StatusBadge, ProgressBar, Drawer, Avatar, AgeBadge } from '@/components/common';
import { ATHLETES, CORE_METRIC_IDS, latestResult } from '@/data';
import type { Athlete, TestTask, TaskStatus } from '@/data';
import type { CoreMetricId } from '@/data';
import { cn } from '@/lib/utils';

/* ---------- 工具：时间窗解析（演示日 2025-06-16） ---------- */
const DEMO_TODAY = new Date('2025-06-16T00:00:00');

function parseWindowEnd(win: string): Date | null {
  const m = win.match(/(\d{1,2})\.(\d{1,2})\s*$/);
  if (!m) return null;
  return new Date(2025, Number(m[1]) - 1, Number(m[2]));
}

function daysLeft(win: string): number | null {
  const end = parseWindowEnd(win);
  if (!end) return null;
  return Math.round((end.getTime() - DEMO_TODAY.getTime()) / 86400000);
}

function windowStartMs(win: string): number {
  const m = win.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return 0;
  return new Date(2025, Number(m[1]) - 1, Number(m[2])).getTime();
}

/** 由 scope 文案推导受测运动员名单（确定性，数据全部来自 ATHLETES） */
function scopeAthletes(scope: string, target: number): Athlete[] {
  if (scope === '全队') return [...ATHLETES];
  if (/^U\d{2}(\+U\d{2})*$/.test(scope)) {
    const groups = scope.split('+');
    return ATHLETES.filter((a) => groups.includes(a.group));
  }
  if (scope.startsWith('GK')) return ATHLETES.filter((a) => a.position === 'GK');
  if (scope.startsWith('跳项重点')) return ATHLETES.filter((a) => a.rtp !== 'red').slice(0, target);
  return ATHLETES.slice(0, target);
}

const STATUS_FILTERS: ('全部' | TaskStatus)[] = ['全部', '进行中', '已完成', '未开始'];

const TOP_BAR: Record<TaskStatus, string> = {
  进行中: '#2563EB',
  已完成: '#16A34A',
  未开始: '#94A3B8',
};

const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'gray'> = { 高: 'red', 中: 'amber', 低: 'gray' };

type SortKey = 'window' | 'progress';

interface TaskBoardProps {
  tasks: TestTask[];
  canUrge: boolean;
  isCoach: boolean;
  onToast: (msg: string, kind?: 'success' | 'info' | 'warning') => void;
}

export default function TaskBoard({ tasks, canUrge, isCoach, onToast }: TaskBoardProps) {
  const [filter, setFilter] = useState<'全部' | TaskStatus>('全部');
  const [sortKey, setSortKey] = useState<SortKey>('window');
  const [detailTask, setDetailTask] = useState<TestTask | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: tasks.length, 进行中: 0, 已完成: 0, 未开始: 0 };
    tasks.forEach((t) => { c[t.status] += 1; });
    return c;
  }, [tasks]);

  const visible = useMemo(() => {
    const list = tasks.filter((t) => filter === '全部' || t.status === filter);
    return [...list].sort((a, b) =>
      sortKey === 'window'
        ? windowStartMs(a.window) - windowStartMs(b.window)
        : b.tested / b.target - a.tested / a.target,
    );
  }, [tasks, filter, sortKey]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2>任务进度看板</h2>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
                  filter === s
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line bg-white text-text-2 hover:border-text-3',
                )}
              >
                {s} <span className="font-mono-data">{counts[s] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-7 appearance-none rounded-full border border-line bg-white pl-3 pr-7 text-xs text-text-2 outline-none transition-colors hover:border-text-3"
            >
              <option value="window">按时间窗</option>
              <option value="progress">按完成率</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-3" />
          </div>
        </div>
      </div>

      <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canUrge={canUrge}
              isCoach={isCoach}
              onToast={onToast}
              onDetail={() => setDetailTask(task)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      <TaskDetailDrawer task={detailTask} onClose={() => setDetailTask(null)} />
    </section>
  );
}

/* ---------- 任务卡 ---------- */

function TaskCard({
  task, canUrge, isCoach, onToast, onDetail,
}: {
  task: TestTask;
  canUrge: boolean;
  isCoach: boolean;
  onToast: (msg: string, kind?: 'success' | 'info' | 'warning') => void;
  onDetail: () => void;
}) {
  const pct = Math.round((task.tested / task.target) * 100);
  const tone = pct >= 100 ? 'green' : pct >= 50 ? 'blue' : 'amber';
  const done = task.status === '已完成';
  const left = daysLeft(task.window);
  const roster = scopeAthletes(task.scope, task.target);
  const untested = roster.slice(task.tested);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cn(
        'relative overflow-hidden rounded-[14px] border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift',
        done && 'opacity-75',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: TOP_BAR[task.status] }} />

      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-line bg-canvas px-1.5 py-px font-mono-data text-[11px] text-text-2">
              {task.scope}
            </span>
            {done && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-px text-[11px] font-medium text-ok">
                <CheckCircle2 className="h-3 w-3" /> 已完成
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-semibold text-text-1" title={task.title}>
            {task.title}
          </h3>
        </div>
        <StatusBadge tone={PRIORITY_TONE[task.priority]} label={`${task.priority}优先`} pulse={false} />
      </div>

      <p className="mt-1.5 truncate text-xs text-text-3">
        指标：{task.items.join(' · ')}
      </p>

      <div className="mt-2 flex items-center gap-3 text-xs text-text-2">
        <span className="inline-flex items-center gap-1">
          <UserRound className="h-3.5 w-3.5 text-text-3" />
          主测：{task.owner}
        </span>
        <span className="font-mono-data text-text-3">{task.window}</span>
        {left !== null && !done && (
          <span className={cn('font-mono-data', left <= 2 ? 'text-risk' : 'text-warn')}>
            {left >= 0 ? `剩 ${left} 天` : `超期 ${-left} 天`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={pct} tone={tone} className="flex-1" />
        <span
          className="font-mono-data text-[13px] font-semibold"
          style={{ color: tone === 'green' ? '#16A34A' : tone === 'blue' ? '#2563EB' : '#D97706' }}
        >
          {pct}%
        </span>
        <span className="font-mono-data text-xs text-text-3">
          {task.tested}/{task.target} 人
        </span>
      </div>

      {!done && untested.length > 0 && (
        <p className="mt-2 truncate text-xs text-text-3">
          未测：{untested.map((a) => a.name).join(' · ')}
        </p>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <button
          onClick={onDetail}
          className="h-8 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition-colors hover:border-brand-600 hover:text-brand-600"
        >
          查看明细
        </button>
        {!done && canUrge && (
          <button
            onClick={() => onToast(`已向 ${untested.length} 名未测运动员推送提醒（演示）`, 'info')}
            className="flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition-colors hover:border-warn hover:text-warn"
          >
            <BellRing className="h-3.5 w-3.5" />
            催办提醒
          </button>
        )}
        {isCoach && task.status === '进行中' && (
          <button
            onClick={() => onToast(`已审批通过「${task.title}」（演示）`)}
            className="flex h-8 items-center gap-1 rounded-lg bg-btn-brand px-3 text-xs font-medium text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            审批
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- 明细抽屉 ---------- */

function TaskDetailDrawer({ task, onClose }: { task: TestTask | null; onClose: () => void }) {
  const roster = useMemo(() => (task ? scopeAthletes(task.scope, task.target) : []), [task]);
  // 取任务第一个有历史成绩的核心指标用于展示分数
  const metricId = useMemo(() => {
    if (!task) return null;
    return (task.itemIds.find((id) => (CORE_METRIC_IDS as readonly string[]).includes(id)) as CoreMetricId | undefined) ?? null;
  }, [task]);

  const testedAthletes = useMemo(() => (task ? roster.slice(0, task.tested) : []), [task, roster]);
  const untestedAthletes = useMemo(() => (task ? roster.slice(task.tested) : []), [task, roster]);
  const scores = useMemo(
    () =>
      metricId
        ? testedAthletes
            .map((a) => latestResult(a.id, metricId)?.value)
            .filter((v): v is number => typeof v === 'number')
        : [],
    [testedAthletes, metricId],
  );
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 1;

  return (
    <Drawer open={!!task} onClose={onClose} title={task?.title ?? ''} width={540}>
      {task && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={task.status === '已完成' ? 'green' : task.status === '进行中' ? 'blue' : 'gray'}
              label={task.status}
              pulse={false}
            />
            <StatusBadge tone={PRIORITY_TONE[task.priority]} label={`${task.priority}优先`} pulse={false} />
            <span className="font-mono-data text-xs text-text-3">{task.window}</span>
            <span className="text-xs text-text-3">主测：{task.owner}</span>
          </div>

          <div className="rounded-xl border border-line bg-canvas/60 p-4">
            <div className="flex items-center justify-between text-xs text-text-2">
              <span>完成进度</span>
              <span className="font-mono-data font-semibold text-text-1">
                {task.tested}/{task.target} 人 · {Math.round((task.tested / task.target) * 100)}%
              </span>
            </div>
            <ProgressBar
              value={(task.tested / task.target) * 100}
              tone={task.tested >= task.target ? 'green' : task.tested / task.target >= 0.5 ? 'blue' : 'amber'}
              className="mt-2"
            />
            {scores.length > 1 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] text-text-3">已测成绩分布（{metricId ? `指标 ${metricId}` : ''}）</p>
                <div className="flex h-6 items-end gap-1">
                  {scores.map((s, i) => (
                    <div
                      key={i}
                      title={String(s)}
                      className="w-3 rounded-sm bg-brand-500/80"
                      style={{ height: `${20 + ((s - min) / (max - min || 1)) * 80}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-brand-600" />
              受测名单
            </h3>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {testedAthletes.map((a) => {
                const r = metricId ? latestResult(a.id, metricId) : undefined;
                return (
                  <div key={a.id} className="flex items-center gap-3 bg-white px-3.5 py-2.5">
                    <Avatar name={a.name} group={a.group} size={28} />
                    <span className="text-sm text-text-1">{a.name}</span>
                    <AgeBadge group={a.group} />
                    <span className="flex-1" />
                    {r && (
                      <span className="font-mono-data text-[13px] font-medium text-text-1">{r.value}</span>
                    )}
                    <CheckCircle2 className="h-4 w-4 text-ok" />
                  </div>
                );
              })}
              {untestedAthletes.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-[#FAFBFD] px-3.5 py-2.5">
                  <Avatar name={a.name} group={a.group} size={28} className="opacity-50" />
                  <span className="text-sm text-text-3">{a.name}</span>
                  <AgeBadge group={a.group} className="opacity-60" />
                  <span className="flex-1" />
                  <span className="font-mono-data text-xs text-text-3">待测</span>
                </div>
              ))}
              {roster.length === 0 && (
                <p className="bg-white px-3.5 py-6 text-center text-xs text-text-3">该任务范围未匹配到运动员</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
