/**
 * RosterFilterBar — 花名册筛选条（roster.md §A.2）
 * 年龄组多选 chip / 位置下拉 / RTP 状态 chip / 姓名搜索 / 重置
 */

import { RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGE_GROUPS, POSITION_LABEL, rtpSummary } from '@/data';
import type { AgeGroup, Position, RTPStatus } from '@/data';

import { EMPTY_FILTER } from './utils';
import type { RosterFilter } from './utils';

interface Props {
  value: RosterFilter;
  onChange: (f: RosterFilter) => void;
}

const STATUS_CHIPS: { key: RTPStatus | 'all'; label: string; dot?: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'green', label: '绿', dot: '#16A34A' },
  { key: 'amber', label: '黄', dot: '#D97706' },
  { key: 'red', label: '红', dot: '#DC2626' },
];

export default function RosterFilterBar({ value, onChange }: Props) {
  const summary = rtpSummary();
  const countOf = (k: RTPStatus | 'all') =>
    k === 'all' ? summary.green + summary.amber + summary.red : summary[k];

  const toggleGroup = (g: AgeGroup) => {
    const groups = value.groups.includes(g) ? value.groups.filter((x) => x !== g) : [...value.groups, g];
    onChange({ ...value, groups });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-white p-4 shadow-card">
      {/* 年龄组多选 */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs text-text-3">年龄组</span>
        {AGE_GROUPS.map((g) => {
          const active = value.groups.includes(g);
          return (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className={cn(
                'h-7 rounded-full border px-2.5 font-mono-data text-xs font-medium transition-all active:scale-95',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-text-2 hover:border-brand-500 hover:text-brand-600',
              )}
            >
              {g}
            </button>
          );
        })}
      </div>

      <span className="h-5 w-px bg-line" />

      {/* 位置下拉 */}
      <label className="flex items-center gap-2 text-xs text-text-3">
        位置
        <select
          value={value.position}
          onChange={(e) => onChange({ ...value, position: e.target.value as Position | 'all' })}
          className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-text-1 outline-none transition-colors focus:border-brand-500"
        >
          <option value="all">全部</option>
          {(Object.keys(POSITION_LABEL) as Position[]).map((p) => (
            <option key={p} value={p}>
              {p} {POSITION_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      <span className="h-5 w-px bg-line" />

      {/* RTP 状态 */}
      <div className="flex items-center gap-1.5">
        {STATUS_CHIPS.map((c) => {
          const active = value.status === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onChange({ ...value, status: c.key })}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-all active:scale-95',
                active ? 'border-brand-600 bg-brand-50 font-semibold text-brand-600' : 'border-line text-text-2 hover:border-brand-500',
              )}
            >
              {c.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />}
              {c.label}
              <span className="font-mono-data text-[11px] text-text-3">{countOf(c.key)}</span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* 搜索 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
          <input
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder="搜索姓名…"
            className="h-8 w-44 rounded-lg border border-line bg-white pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-text-3 focus:border-brand-500"
          />
        </div>
        <button
          onClick={() => onChange(EMPTY_FILTER)}
          className="flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs text-text-2 transition-colors hover:bg-canvas active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </button>
      </div>
    </div>
  );
}
