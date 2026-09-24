/**
 * SelectorBar — 趋势页 sticky 选择器条（trends.md §2）
 * 运动员多选(≤3) / 指标分组下拉 / 时间窗分段 / 常模带与事件标记开关
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Lock, Search, X } from 'lucide-react';
import { Avatar } from '@/components/common';
import { ATHLETES } from '@/data';
import { cn } from '@/lib/utils';
import { CORE_TREND_METRICS, BODY_TREND_METRICS } from './trendUtils';
import type { TimeWindow, TrendMetric } from './trendUtils';

interface SelectorBarProps {
  athleteIds: string[];
  onAthletesChange: (ids: string[]) => void;
  metric: TrendMetric;
  onMetricChange: (m: TrendMetric) => void;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
  showNorm: boolean;
  onShowNormChange: (v: boolean) => void;
  showEvents: boolean;
  onShowEventsChange: (v: boolean) => void;
  compareMode: boolean;
  isDoctor: boolean;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-text-2">
      {label}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-line')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/** 运动员多选下拉（带搜索，最多 3 人） */
function AthletePicker({ ids, onChange, disabled }: { ids: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const list = ATHLETES.filter((a) => q === '' || a.name.includes(q) || a.id.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string) => {
    if (ids.includes(id)) {
      if (ids.length > 1) onChange(ids.filter((x) => x !== id));
    } else if (ids.length < 3) {
      onChange([...ids, id]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {ids.map((id) => {
          const a = ATHLETES.find((x) => x.id === id)!;
          return (
            <span key={id} className="flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pl-1 pr-1.5 text-xs">
              <Avatar name={a.name} group={a.group} size={18} />
              <span className="font-medium text-text-1">{a.name}</span>
              {ids.length > 1 && (
                <button onClick={() => toggle(id)} className="rounded-full p-0.5 text-text-3 hover:bg-canvas hover:text-text-1" aria-label={`移除 ${a.name}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
        {!disabled && ids.length < 3 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-xs text-text-3 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            添加对比
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-9 z-30 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-lift"
          >
            <div className="relative border-b border-line">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索姓名 / 编号…"
                className="h-9 w-full bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-text-3"
              />
            </div>
            <div className="max-h-56 overflow-auto py-1">
              {list.map((a) => {
                const selected = ids.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    disabled={!selected && ids.length >= 3}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-canvas disabled:opacity-40"
                  >
                    <Avatar name={a.name} group={a.group} size={24} />
                    <span className="flex-1 text-text-1">{a.name}</span>
                    <span className="font-mono-data text-[11px] text-text-3">
                      {a.id} · {a.group}
                    </span>
                    {selected && <Check className="h-4 w-4 text-brand-600" />}
                  </button>
                );
              })}
              {list.length === 0 && <p className="px-3 py-4 text-center text-xs text-text-3">无匹配运动员</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SelectorBar(p: SelectorBarProps) {
  const metrics = p.isDoctor ? BODY_TREND_METRICS : CORE_TREND_METRICS;
  const groups = [...new Set(metrics.map((m) => m.category))];

  return (
    <div className="sticky top-16 z-20 rounded-[14px] border border-line bg-white/95 p-4 shadow-card backdrop-blur">
      {p.isDoctor && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#F5D9A8] bg-warn-bg px-3 py-2 text-xs text-warn">
          <Lock className="h-3.5 w-3.5" />
          队医角色仅可查看身体形态与医疗功能类指标，其余指标组已锁定（演示 RBAC）
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* 运动员多选 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-3">运动员</span>
          <AthletePicker ids={p.athleteIds} onChange={p.onAthletesChange} disabled={!p.compareMode} />
          {!p.compareMode && <span className="text-[11px] text-text-3">（开启对比模式可多选）</span>}
        </div>

        <span className="hidden h-5 w-px bg-line md:block" />

        {/* 指标选择 */}
        <label className="flex items-center gap-2 text-xs text-text-3">
          指标
          <select
            value={p.metric.key}
            onChange={(e) => {
              const m = metrics.find((x) => x.key === e.target.value);
              if (m) p.onMetricChange(m);
            }}
            className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-text-1 outline-none focus:border-brand-500"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {metrics
                  .filter((m) => m.category === g)
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}（{m.unit}）
                    </option>
                  ))}
              </optgroup>
            ))}
            {p.isDoctor && (
              <optgroup label="🔒 速度与敏捷 / 力量 / 耐力 / 技能（无权限）">
                {CORE_TREND_METRICS.map((m) => (
                  <option key={m.key} disabled>
                    🔒 {m.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <span className="hidden h-5 w-px bg-line md:block" />

        {/* 时间窗 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-3">时间窗</span>
          <div className="flex rounded-lg border border-line p-0.5">
            {([4, 8, 'all'] as TimeWindow[]).map((w) => (
              <button
                key={String(w)}
                onClick={() => p.onWindowChange(w)}
                className={cn(
                  'h-7 rounded-md px-3 text-xs transition-all',
                  p.window === w ? 'bg-brand-600 font-semibold text-white' : 'text-text-2 hover:bg-canvas',
                )}
              >
                {w === 'all' ? '全部' : `近${w}次`}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <Toggle checked={p.showNorm} onChange={p.onShowNormChange} label="常模带" />
          <Toggle checked={p.showEvents} onChange={p.onShowEventsChange} label="事件标记" />
        </div>
      </div>
    </div>
  );
}
