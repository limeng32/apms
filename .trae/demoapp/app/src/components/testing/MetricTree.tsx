/**
 * MetricTree — 指标库勾选树（testing.md §2.1）
 * 搜索 + 5 大类手风琴（默认展开"速度与敏捷"）+ 全选 + 底部吸附已选条
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, ChevronDown, Check, Timer, Gauge, Radio, ClipboardList,
  Scan, Ruler, Zap, HeartPulse, Dribbble,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TEST_CATEGORIES, TEST_ITEMS, CATEGORY_CODE } from '@/data';
import type { TestCategory, TestDevice, TestItem } from '@/data';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<TestCategory, LucideIcon> = {
  身体形态: Ruler,
  速度与敏捷: Zap,
  力量与爆发: Gauge,
  耐力: HeartPulse,
  足球专项技能: Dribbble,
};

const DEVICE_ICON: Record<TestDevice, LucideIcon> = {
  人工: ClipboardList,
  测力台: Gauge,
  计时门: Timer,
  GPS: Radio,
};

interface MetricTreeProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleCategory: (cat: TestCategory, select: boolean) => void;
  onClear: () => void;
}

export default function MetricTree({ selectedIds, onToggle, onToggleCategory, onClear }: MetricTreeProps) {
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<TestCategory[]>(['速度与敏捷']);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return TEST_ITEMS;
    return TEST_ITEMS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  }, [query]);

  const toggleCat = (cat: TestCategory) =>
    setOpenCats((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-line bg-white shadow-card">
      {/* 头部 + 搜索 */}
      <div className="border-b border-line px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2">
            <Scan className="h-4 w-4 text-brand-600" />
            指标库
          </h3>
          <span className="text-xs text-text-3">5 大类 · {TEST_ITEMS.length} 项</span>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索指标名…"
            className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-3 text-[13px] text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-brand-600 focus:bg-white"
          />
        </div>
      </div>

      {/* 手风琴分组 */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {TEST_CATEGORIES.map((cat) => {
          const items = filtered.filter((t) => t.category === cat);
          if (query.trim() && items.length === 0) return null;
          const open = query.trim() ? true : openCats.includes(cat);
          const catAll = TEST_ITEMS.filter((t) => t.category === cat);
          const selectedCount = catAll.filter((t) => selected.has(t.id)).length;
          const allSelected = selectedCount === catAll.length && catAll.length > 0;
          const Icon = CATEGORY_ICON[cat];
          return (
            <div key={cat} className="mb-1">
              <div className="flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-canvas">
                <button onClick={() => toggleCat(cat)} className="flex flex-1 items-center gap-2 text-left">
                  <Icon className="h-4 w-4 text-text-3" />
                  <span className="text-[13px] font-medium text-text-1">{cat}</span>
                  <span className="rounded-full bg-canvas px-1.5 py-px font-mono-data text-[11px] text-text-3">
                    {CATEGORY_CODE[cat]} · {catAll.length}
                  </span>
                  {selectedCount > 0 && (
                    <span className="rounded-full bg-brand-50 px-1.5 py-px font-mono-data text-[11px] font-medium text-brand-600">
                      已选 {selectedCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => onToggleCategory(cat, !allSelected)}
                  className="text-xs text-brand-600 transition-colors hover:text-brand-700"
                >
                  {allSelected ? '取消全选' : '全选'}
                </button>
                <button onClick={() => toggleCat(cat)} className="p-0.5 text-text-3">
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="py-1">
                      {items.map((item) => (
                        <MetricRow key={item.id} item={item} checked={selected.has(item.id)} onToggle={() => onToggle(item.id)} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {query.trim() && filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-text-3">没有匹配「{query}」的指标</p>
        )}
      </div>

      {/* 底部吸附条 */}
      <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-5 py-3">
        <span className="text-[13px] text-text-2">
          已选 <span className="font-mono-data font-semibold text-brand-600">{selectedIds.length}</span> 项指标
        </span>
        <button
          onClick={onClear}
          disabled={selectedIds.length === 0}
          className="text-xs text-text-3 transition-colors hover:text-risk disabled:cursor-not-allowed disabled:opacity-40"
        >
          清空
        </button>
      </div>
    </div>
  );
}

function MetricRow({ item, checked, onToggle }: { item: TestItem; checked: boolean; onToggle: () => void }) {
  const DeviceIcon = DEVICE_ICON[item.device];
  return (
    <button
      onClick={onToggle}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md border-l-[3px] px-2.5 py-1.5 text-left transition-all duration-150',
        checked ? 'border-brand-600 bg-brand-50/60' : 'border-transparent hover:bg-canvas',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-brand-600 bg-brand-600' : 'border-line bg-white group-hover:border-text-3',
        )}
      >
        {checked && (
          <motion.span initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 0.15 }}>
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </motion.span>
        )}
      </span>
      <span className="flex-1 truncate text-[13px] text-text-1">{item.name}</span>
      {item.unit && <span className="font-mono-data text-[11px] text-text-3">{item.unit}</span>}
      {item.hasNorm && (
        <span
          title="有年龄组常模"
          className="flex h-4 w-4 items-center justify-center rounded bg-brand-50 font-mono-data text-[10px] font-semibold text-brand-600"
        >
          N
        </span>
      )}
      <DeviceIcon className="h-3.5 w-3.5 text-text-3" aria-label={item.device} />
    </button>
  );
}
