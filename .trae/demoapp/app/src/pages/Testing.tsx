/**
 * /testing — 测试指标库与任务下发（testing.md）
 * 区块一：指标勾选树 + 任务下发器（双向联动）
 * 区块二：足球专项模型库（深色 4 卡）
 * 区块三：任务进度看板（过滤/催办/审批/Drawer 明细）
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { TEST_ITEMS, TEST_MODELS, TEST_TASKS, getTestItem } from '@/data';
import type { TestCategory, TestModel, TestTask } from '@/data';
import MetricTree from '@/components/testing/MetricTree';
import TaskDispatcher from '@/components/testing/TaskDispatcher';
import type { DispatchDraft } from '@/components/testing/TaskDispatcher';
import ModelLibrary from '@/components/testing/ModelLibrary';
import TaskBoard from '@/components/testing/TaskBoard';
import { cn } from '@/lib/utils';

/** '2025-06-16' → '6.16' */
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${Number(m)}.${Number(day)}`;
}

export default function Testing() {
  const { role } = useRole();
  const { toast } = useToast();
  const isFitness = role === 'fitness';
  const isCoach = role === 'coach';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TestTask[]>(TEST_TASKS);
  const [prefillName, setPrefillName] = useState('');
  const dispatcherRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => getTestItem(id)).filter((t): t is NonNullable<typeof t> => !!t),
    [selectedIds],
  );

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleCategory = useCallback((cat: TestCategory, select: boolean) => {
    const ids = TEST_ITEMS.filter((t) => t.category === cat).map((t) => t.id);
    setSelectedIds((prev) => (select ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id))));
  }, []);

  const scrollToDispatcher = useCallback(() => {
    dispatcherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /** 模型卡一键预填：勾选对应指标 + 名称预填 + 滚动定位 */
  const handleUseModel = useCallback(
    (model: TestModel) => {
      setSelectedIds((prev) => [...new Set([...prev, ...model.itemIds])]);
      setPrefillName(`${model.name} · 新任务 ${Date.now()}`);
      scrollToDispatcher();
      toast(`已载入模型「${model.name}」，指标已自动勾选`, 'info');
    },
    [scrollToDispatcher, toast],
  );

  /** 下发任务：看板顶部 spring 插入新卡 + Toast + 表单重置（重置在 Dispatcher 内） */
  const handleSubmit = useCallback(
    (draft: DispatchDraft) => {
      const task: TestTask = {
        id: `T${String(tasks.length + 1).padStart(2, '0')}-N${Date.now() % 1000}`,
        title: draft.name,
        items: draft.items.map((i) => i.name),
        itemIds: draft.items.map((i) => i.id),
        scope: draft.groups.join('+'),
        target: draft.targetCount,
        tested: 0,
        owner: draft.owner,
        window: `${fmtDate(draft.windowStart)}–${fmtDate(draft.windowEnd)}`,
        status: '未开始',
        priority: draft.priority,
      };
      setTasks((prev) => [task, ...prev]);
      setSelectedIds([]);
      toast(`任务已下发至 ${draft.targetCount} 名运动员（演示）`);
    },
    [tasks.length, toast],
  );

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>测试指标库与任务下发</h1>
          <p className="mt-1 text-sm text-text-2">
            {TEST_ITEMS.length} 项指标 · {TEST_MODELS.length} 套足球专项模型 ·{' '}
            <span className="font-mono-data">{tasks.length}</span> 个测试任务
          </p>
        </div>
        <button
          onClick={isFitness ? scrollToDispatcher : undefined}
          disabled={!isFitness}
          title={isFitness ? undefined : '仅体能师可下发任务（演示 RBAC）'}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-lg bg-btn-brand px-4 text-sm font-medium text-white shadow-card transition-all duration-150',
            'hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <Plus className="h-4 w-4" />
          新建测试任务
        </button>
      </div>

      {/* 区块一：指标库 + 任务下发器（5/7） */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5" style={{ minHeight: 560 }}>
          <MetricTree
            selectedIds={selectedIds}
            onToggle={toggleItem}
            onToggleCategory={toggleCategory}
            onClear={() => setSelectedIds([])}
          />
        </div>
        <div className="xl:col-span-7" ref={dispatcherRef} style={{ scrollMarginTop: 88 }}>
          <TaskDispatcher
            selectedItems={selectedItems}
            onRemoveItem={toggleItem}
            onSubmit={handleSubmit}
            readOnly={!isFitness}
            prefillName={prefillName}
          />
        </div>
      </div>

      {/* 区块二：足球专项模型库 */}
      <ModelLibrary onUse={handleUseModel} />

      {/* 区块三：任务进度看板 */}
      <TaskBoard tasks={tasks} canUrge={isFitness || isCoach} isCoach={isCoach} onToast={toast} />
    </div>
  );
}
