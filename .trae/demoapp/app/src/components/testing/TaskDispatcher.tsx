/**
 * TaskDispatcher — 任务下发器（testing.md §2.2）
 * 与指标树联动的下发表单：名称 / 已选指标 chip / 目标人群 / 主测人 / 时间窗 / 优先级 / 备注
 * 非体能师角色只读蒙层 + 提示条
 */

import { useMemo, useState } from 'react';
import { Send, Loader2, X, ShieldAlert } from 'lucide-react';
import { AGE_GROUPS, ATHLETES } from '@/data';
import type { AgeGroup, TestItem, TaskPriority } from '@/data';
import { GROUP_COLOR } from '@/data/athletes';
import { cn } from '@/lib/utils';

const OWNERS = [
  { name: '李泽锋', title: '体能教练', color: '#06B6D4' },
  { name: '王雪', title: '队医主管', color: '#16A34A' },
  { name: '陈思远', title: '运动科学博士', color: '#8B5CF6' },
];

const PRIORITIES: TaskPriority[] = ['高', '中', '低'];

export interface DispatchDraft {
  name: string;
  items: TestItem[];
  groups: AgeGroup[];
  owner: string;
  windowStart: string;
  windowEnd: string;
  priority: TaskPriority;
  note: string;
  targetCount: number;
}

interface TaskDispatcherProps {
  selectedItems: TestItem[];
  onRemoveItem: (id: string) => void;
  onSubmit: (draft: DispatchDraft) => void;
  readOnly: boolean;
  /** 模型卡一键预填（变化时写入名称） */
  prefillName: string;
}

export default function TaskDispatcher({ selectedItems, onRemoveItem, onSubmit, readOnly, prefillName }: TaskDispatcherProps) {
  const [name, setName] = useState('');
  const [groups, setGroups] = useState<AgeGroup[]>(['U17', 'U18']);
  const [owner, setOwner] = useState(OWNERS[0].name);
  const [windowStart, setWindowStart] = useState('2025-06-16');
  const [windowEnd, setWindowEnd] = useState('2025-06-22');
  const [priority, setPriority] = useState<TaskPriority>('中');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastPrefill, setLastPrefill] = useState('');

  // 渲染期同步预填名称（React 推荐的 prev-props 对比模式）
  if (prefillName !== lastPrefill) {
    setLastPrefill(prefillName);
    if (prefillName) setName(prefillName);
  }

  const targetCount = useMemo(
    () => ATHLETES.filter((a) => groups.includes(a.group)).length,
    [groups],
  );

  const toggleGroup = (g: AgeGroup) =>
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const canSubmit = !readOnly && !submitting && selectedItems.length > 0 && groups.length > 0;

  const reset = () => {
    setName('');
    setGroups(['U17', 'U18']);
    setOwner(OWNERS[0].name);
    setWindowStart('2025-06-16');
    setWindowEnd('2025-06-22');
    setPriority('中');
    setNote('');
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const draft: DispatchDraft = {
      name: name.trim() || `${groups.join('–')} ${selectedItems[0]?.name ?? ''} 测试`,
      items: selectedItems,
      groups,
      owner,
      windowStart,
      windowEnd,
      priority,
      note,
      targetCount,
    };
    // 演示：loading 600ms 后提交
    setTimeout(() => {
      onSubmit(draft);
      setSubmitting(false);
      reset();
    }, 600);
  };

  return (
    <div className="relative flex h-full flex-col rounded-[14px] border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-3.5">
        <h3>下发新测试任务</h3>
        <p className="mt-0.5 text-xs text-text-3">勾选左侧指标后组合下发，任务将同步至进度看板</p>
      </div>

      <div className={cn('flex-1 p-5', readOnly && 'pointer-events-none select-none opacity-50')}>
        <div className="grid grid-cols-2 gap-4">
          {/* 任务名称 */}
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs font-medium text-text-2">任务名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：U17–U18 Yo-Yo 间歇恢复测试"
              className="h-10 w-full rounded-lg border border-line px-3 text-sm text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-brand-600"
            />
          </label>

          {/* 已选指标 chip 区 */}
          <div className="col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-text-2">
              已选指标 <span className="font-mono-data text-text-3">({selectedItems.length})</span>
            </span>
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-line bg-canvas/50 px-2.5 py-2">
              {selectedItems.length === 0 && (
                <span className="text-xs text-text-3">从左侧指标库勾选，或点击模型卡一键预填</span>
              )}
              {selectedItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-600/25 bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                >
                  {item.name}
                  <button onClick={() => onRemoveItem(item.id)} className="rounded-full p-px hover:bg-brand-600/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 目标人群 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-2">目标人群（年龄组）</span>
            <div className="flex flex-wrap gap-1.5">
              {AGE_GROUPS.map((g) => {
                const active = groups.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGroup(g)}
                    className={cn(
                      'h-7 rounded-full border px-2.5 font-mono-data text-xs font-medium transition-all',
                      active ? 'border-transparent text-white' : 'border-line bg-white text-text-2 hover:border-text-3',
                    )}
                    style={active ? { background: GROUP_COLOR[g] } : undefined}
                  >
                    {g}
                  </button>
                );
              })}
              <span className="ml-1 self-center text-xs text-text-3">
                预计 <span className="font-mono-data font-semibold text-brand-600">{targetCount}</span> 人
              </span>
            </div>
          </div>

          {/* 主测责任人 */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-2">主测责任人</span>
            <div className="relative">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-line bg-white pl-8 pr-3 text-sm text-text-1 outline-none transition-colors focus:border-brand-600"
              >
                {OWNERS.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name} · {o.title}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                style={{ background: OWNERS.find((o) => o.name === owner)?.color }}
              />
            </div>
          </label>

          {/* 时间窗口 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-2">时间窗口</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-line px-2.5 font-mono-data text-[13px] text-text-1 outline-none transition-colors focus:border-brand-600"
              />
              <span className="text-text-3">–</span>
              <input
                type="date"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-line px-2.5 font-mono-data text-[13px] text-text-1 outline-none transition-colors focus:border-brand-600"
              />
            </div>
          </div>

          {/* 优先级 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-2">优先级</span>
            <div className="flex h-10 overflow-hidden rounded-lg border border-line">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 text-sm font-medium transition-colors duration-150',
                    priority === p ? 'bg-brand-600 text-white' : 'bg-white text-text-2 hover:bg-canvas',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs font-medium text-text-2">备注</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={1}
              placeholder="测试前 24h 避免大强度训练…"
              className="w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-brand-600"
            />
          </label>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className={cn('flex items-center justify-end gap-2 border-t border-line px-5 py-3.5', readOnly && 'pointer-events-none opacity-50')}>
        <button
          onClick={reset}
          className="h-10 rounded-lg border border-line px-4 text-sm font-medium text-text-2 transition-colors hover:bg-canvas"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-lg bg-btn-brand px-5 text-sm font-medium text-white shadow-card transition-all duration-150',
            'hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? '下发中…' : '下发任务'}
        </button>
      </div>

      {/* 只读角色提示条 */}
      {readOnly && (
        <div className="pointer-events-auto absolute left-4 right-4 top-16 flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-700 shadow-card">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          当前角色仅可查看（演示 RBAC 权限隔离），任务下发仅对体能师开放
        </div>
      )}
    </div>
  );
}
