/**
 * RosterTable — 花名册表格（roster.md §A.3）
 * sticky 表头 / 行 hover / 整行点击进档案 / 红黄行 3px 状态左边条 / 分页
 * 队医角色隐藏敏感测试列（Yo-Yo / 30m / ACWR）
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgeBadge, Avatar, EmptyState, StatusBadge, useToast } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { acwrZone, latestResult, POSITION_LABEL, RTP_LABEL } from '@/data';
import type { Athlete } from '@/data';
import { lastDelta } from './utils';

const PAGE_SIZE = 12;

const ACWR_COLOR = { green: '#16A34A', amber: '#D97706', red: '#DC2626' } as const;
const ROW_EDGE: Record<string, string> = { red: '#DC2626', amber: '#D97706' };

/** 数值 + 环比趋势小箭头（箭头 = 数值涨跌方向，颜色 = 是否向好） */
function TrendValue({ athleteId, itemId, unit }: { athleteId: string; itemId: 'E01' | 'S02'; unit: string }) {
  const latest = latestResult(athleteId, itemId);
  const d = lastDelta(athleteId, itemId);
  if (!latest) return <span className="text-text-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-cell-num text-text-1 tnum">
        {latest.value}
        <span className="ml-0.5 text-[11px] text-text-3">{unit}</span>
      </span>
      {d && (
        <span
          className={cn('inline-flex items-center font-mono-data text-[11px] font-medium', d.good ? 'text-ok' : 'text-risk')}
          title={`较上次 ${d.text}${unit}`}
        >
          {d.dir === 'flat' ? (
            <Minus className="h-3 w-3 text-text-3" />
          ) : d.dir === 'up' ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {d.text}
        </span>
      )}
    </span>
  );
}

/** 行内 ⋮ 操作菜单（演示 Toast） */
function RowMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const act = (label: string) => {
    setOpen(false);
    toast(`${label}「${name}」（演示环境暂不支持）`, 'info');
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-text-3 transition-colors hover:bg-canvas hover:text-text-1"
        aria-label="更多操作"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lift"
          >
            {['编辑档案', '标记关注', '停用档案'].map((label) => (
              <button
                key={label}
                onClick={() => act(label)}
                className="block w-full px-3.5 py-2 text-left text-sm text-text-2 transition-colors hover:bg-canvas hover:text-text-1"
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RosterTable({ athletes }: { athletes: Athlete[] }) {
  const navigate = useNavigate();
  const { role } = useRole();
  const [page, setPage] = useState(0);
  const hideTestCols = role === 'doctor'; // 队医视角隐藏敏感测试列

  const pages = Math.max(1, Math.ceil(athletes.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const rows = athletes.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  const thCls = 'px-4 py-3 text-left text-micro uppercase text-text-3 whitespace-nowrap';
  const thNumCls = 'px-4 py-3 text-right text-micro uppercase text-text-3 whitespace-nowrap';

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line">
              <th className={thCls}>运动员</th>
              <th className={thCls}>年龄组</th>
              <th className={thCls}>位置</th>
              <th className={thNumCls}>身高 / 体重</th>
              <th className={thNumCls}>体脂率</th>
              {!hideTestCols && <th className={thNumCls}>最近 Yo-Yo</th>}
              {!hideTestCols && <th className={thNumCls}>30m 冲刺</th>}
              <th className={thCls}>RTP 状态</th>
              {!hideTestCols && <th className={thNumCls}>ACWR</th>}
              <th className={cn(thCls, 'text-right')}>操作</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((a, i) => (
                <motion.tr
                  key={a.id}
                  layout="position"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  onClick={() => navigate(`/athletes/${a.id}`)}
                  className={cn('cursor-pointer border-b border-line transition-colors hover:bg-[#F8FAFF]', i % 2 === 1 && 'bg-[#FAFBFD]')}
                  style={ROW_EDGE[a.rtp] ? { boxShadow: `inset 3px 0 0 ${ROW_EDGE[a.rtp]}` } : undefined}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.name} group={a.group} size={34} />
                      <div>
                        <p className="text-sm font-semibold text-text-1">{a.name}</p>
                        <p className="font-mono-data text-[11px] text-text-3">{a.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <AgeBadge group={a.group} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-canvas px-2 py-0.5 font-mono-data text-xs font-medium text-text-2">
                      {a.position} · {POSITION_LABEL[a.position]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-cell-num text-text-1 tnum">
                      {a.height}cm <span className="text-text-3">/</span> {a.weight}kg
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-cell-num text-text-1 tnum">{a.bodyFat}%</span>
                  </td>
                  {!hideTestCols && (
                    <td className="px-4 py-2.5 text-right">
                      <TrendValue athleteId={a.id} itemId="E01" unit="m" />
                    </td>
                  )}
                  {!hideTestCols && (
                    <td className="px-4 py-2.5 text-right">
                      <TrendValue athleteId={a.id} itemId="S02" unit="s" />
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={a.rtp} label={RTP_LABEL[a.rtp]} pulse={a.rtp === 'red'} />
                  </td>
                  {!hideTestCols && (
                    <td className="px-4 py-2.5 text-right">
                      {a.acwr === null ? (
                        <span className="text-cell-num text-text-3">—</span>
                      ) : (
                        <span className="text-cell-num font-semibold tnum" style={{ color: ACWR_COLOR[acwrZone(a.acwr)] }}>
                          {a.acwr.toFixed(2)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/athletes/${a.id}`);
                        }}
                        className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                      >
                        查看档案 →
                      </button>
                      <RowMenu name={a.name} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <EmptyState title="没有匹配的运动员" desc="请调整筛选条件或搜索关键词" />}

      {/* 分页 */}
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <span className="text-xs text-text-3">
          共 <span className="font-mono-data font-medium text-text-2">{athletes.length}</span> 人 · 每页 {PAGE_SIZE} 条
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={cur === 0}
            onClick={() => setPage(cur - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-text-2 transition-colors enabled:hover:bg-canvas disabled:opacity-40"
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <Fragment key={i}>
              <button
                onClick={() => setPage(i)}
                className={cn(
                  'h-7 w-7 rounded-lg font-mono-data text-xs transition-colors',
                  i === cur ? 'bg-brand-600 font-semibold text-white' : 'border border-line text-text-2 hover:bg-canvas',
                )}
              >
                {i + 1}
              </button>
            </Fragment>
          ))}
          <button
            disabled={cur >= pages - 1}
            onClick={() => setPage(cur + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-text-2 transition-colors enabled:hover:bg-canvas disabled:opacity-40"
            aria-label="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
