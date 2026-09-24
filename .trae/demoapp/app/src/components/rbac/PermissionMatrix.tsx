/**
 * PermissionMatrix — RBAC 权限矩阵（rbac.md §3 / §5）
 * 行=10 模块（分组），列=4 角色；十字高亮、单元格 tooltip、主教练单元格编辑演示
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PencilLine } from 'lucide-react';
import {
  ACCESS_LABEL,
  ACCESS_SYMBOL,
  MODULES,
  RBAC_MATRIX,
  ROLE_LIST,
  type AccessLevel,
  type ModuleKey,
  type RoleKey,
} from '@/data';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** 模块分组（design.md §6.1 导航分组一致） */
const MODULE_GROUPS: { group: string; modules: ModuleKey[] }[] = [
  { group: '总览', modules: ['dashboard'] },
  { group: '运动员', modules: ['athletes', 'development', 'trends'] },
  { group: '测试', modules: ['testing', 'combo'] },
  { group: '健康', modules: ['health', 'medical'] },
  { group: '分析', modules: ['reports'] },
  { group: '系统', modules: ['rbac'] },
];

/** 单元格能力说明（tooltip，rbac.md §3 示例扩展） */
const CELL_NOTES: Partial<Record<ModuleKey, Partial<Record<RoleKey, string>>>> = {
  dashboard: { doctor: '医疗摘要版：仅 RTP / 伤病相关卡片' },
  athletes: { fitness: '隐藏医疗编辑入口', doctor: '仅基础信息 + 医疗 tab', analyst: '只读，不可编辑档案' },
  trends: { doctor: '仅医疗 / 形态指标序列' },
  testing: { coach: '只读 + 任务审批', fitness: '查看 / 创建任务 / 下发 / 催办；不可审批', analyst: '只读指标库与任务进度' },
  combo: { coach: '只读 + 排期审批', analyst: '只读结果与得分' },
  health: { fitness: '仅负荷类预警', doctor: '可处置 / 闭环预警', analyst: '只读 + 导出' },
  medical: { coach: '脱敏摘要（隐去诊断细节）', fitness: '仅 RTP 阶段状态', analyst: '脱敏统计视图' },
  reports: { fitness: '仅体能类 + 综合类报告', doctor: '仅医疗类 + 综合类报告' },
  rbac: { analyst: '只读矩阵，不可编辑' },
};

const LEVEL_STYLE: Record<AccessLevel, { label: string }> = {
  full: { label: '全部权限（查看 / 编辑 / 删除）' },
  partial: { label: '部分 / 只读' },
  none: { label: '不可见（菜单隐藏）' },
};

function cellColor(level: AccessLevel, role: RoleKey): string {
  if (level === 'full') return role === 'coach' ? '#2563EB' : '#16A34A';
  if (level === 'partial') return '#D97706';
  return '#94A3B8';
}

function CellGlyph({ level, role }: { level: AccessLevel; role: RoleKey }) {
  const color = cellColor(level, role);
  if (level === 'none') {
    return <span className="inline-block h-0.5 w-3.5 rounded-full bg-text-3/60" aria-label="无权限" />;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <motion.span
        key={level}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
        className="text-sm leading-none"
        style={{ color }}
      >
        {ACCESS_SYMBOL[level]}
      </motion.span>
      <span className="hidden text-[11px] lg:inline" style={{ color }}>
        {level === 'full' ? '管理' : '部分'}
      </span>
    </span>
  );
}

export default function PermissionMatrix() {
  const { role } = useRole();
  const { toast } = useToast();
  const canEdit = role === 'coach';

  /** 演示编辑覆盖层（仅前端 state，不持久化） */
  const [overrides, setOverrides] = useState<Record<string, AccessLevel>>({});
  const [hoverRow, setHoverRow] = useState<ModuleKey | null>(null);
  const [hoverCol, setHoverCol] = useState<RoleKey | null>(null);

  const levelOf = (m: ModuleKey, r: RoleKey): AccessLevel => overrides[`${m}:${r}`] ?? RBAC_MATRIX[m][r];

  const applyEdit = (m: ModuleKey, r: RoleKey, level: AccessLevel) => {
    setOverrides((prev) => ({ ...prev, [`${m}:${r}`]: level }));
    toast(`已将 ${ROLE_LIST.find((x) => x.key === r)?.name.split(' ')[0]}×${MODULES[m].label} 调整为 ${ACCESS_LABEL[level]}（演示，刷新后还原）`, 'info');
  };

  const edited = Object.keys(overrides).length > 0;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-card">
      {/* 头部 + 图例 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h3>权限矩阵</h3>
          <p className="mt-0.5 text-xs text-text-3">
            10 个功能模块 × 4 个演示角色{canEdit ? ' · 点击单元格可演示调整' : ' · 只读视图'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-text-2">
          <span className="flex items-center gap-1.5"><span className="text-ok">●</span> 全部权限（查看/编辑/删除）</span>
          <span className="flex items-center gap-1.5"><span className="text-warn">◐</span> 部分/只读</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 rounded-full bg-text-3/60" /> 不可见（菜单隐藏）</span>
        </div>
      </div>

      {/* 演示模式黄条 */}
      {(canEdit || edited) && (
        <div className="flex items-center justify-between gap-2 border-b border-warn/30 bg-warn-bg px-5 py-2 text-xs text-warn">
          <span>演示模式：权限修改不会持久保存，刷新页面后自动还原</span>
          {edited && (
            <button
              onClick={() => { setOverrides({}); toast('已还原全部权限调整（演示）', 'info'); }}
              className="shrink-0 rounded-md border border-warn/40 bg-white/70 px-2 py-0.5 font-medium hover:bg-white"
            >
              一键还原
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="sticky left-0 z-10 w-56 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-3">
                模块 \ 角色
              </th>
              {ROLE_LIST.map((r) => (
                <th
                  key={r.key}
                  className={cn(
                    'px-4 py-3 text-center transition-colors duration-100',
                    hoverCol === r.key && 'bg-brand-50',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                    {r.name.split(' / ')[0]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_GROUPS.map((g) =>
              g.modules.map((m, gi) => {
                const info = MODULES[m];
                const rowHot = hoverRow === m;
                return (
                  <tr
                    key={m}
                    onMouseEnter={() => setHoverRow(m)}
                    onMouseLeave={() => { setHoverRow(null); setHoverCol(null); }}
                    className={cn('border-b border-line transition-colors duration-100', rowHot && 'bg-[#F8FAFF]')}
                  >
                    <td className={cn('sticky left-0 z-10 px-5 py-3 transition-colors duration-100', rowHot ? 'bg-[#F8FAFF]' : 'bg-white')}>
                      <div className="flex items-center gap-2.5">
                        {gi === 0 && (
                          <span className="w-9 shrink-0 rounded bg-canvas px-1 py-0.5 text-center text-[10px] font-medium text-text-3">
                            {g.group}
                          </span>
                        )}
                        {gi !== 0 && <span className="w-9 shrink-0" />}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-text-1">{info.label}</p>
                          <p className="font-mono-data text-[10px] text-text-3">{info.path}</p>
                        </div>
                      </div>
                    </td>
                    {ROLE_LIST.map((r, ri) => {
                      const level = levelOf(m, r.key);
                      const note = CELL_NOTES[m]?.[r.key];
                      const cell = (
                        <div
                          className={cn(
                            'flex h-full w-full items-center justify-center gap-1 px-2 py-1.5',
                            canEdit && 'cursor-pointer',
                          )}
                        >
                          <CellGlyph level={level} role={r.key} />
                          {canEdit && <PencilLine className="h-3 w-3 text-text-3 opacity-0 transition-opacity group-hover/cell:opacity-60" />}
                        </div>
                      );
                      return (
                        <td
                          key={r.key}
                          onMouseEnter={() => setHoverCol(r.key)}
                          className={cn(
                            'group/cell border-l border-line/60 px-2 py-2 text-center transition-colors duration-100',
                            (rowHot || hoverCol === r.key) && 'bg-brand-50/70',
                            overrides[`${m}:${r.key}`] && 'bg-warn-bg/50',
                          )}
                          style={{ transitionDelay: `${ri * 20}ms` }}
                        >
                          {canEdit ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full">{cell}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="center">
                                <p className="px-1.5 pb-1.5 text-[11px] font-semibold text-text-2">
                                  {r.name.split(' / ')[0]} × {info.label}
                                </p>
                                {(['full', 'partial', 'none'] as AccessLevel[]).map((lv) => (
                                  <button
                                    key={lv}
                                    onClick={() => applyEdit(m, r.key, lv)}
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-canvas',
                                      level === lv && 'bg-brand-50',
                                    )}
                                  >
                                    <CellGlyph level={lv} role={r.key} />
                                    <span className="flex-1 text-text-2">{LEVEL_STYLE[lv].label}</span>
                                    {level === lv && <span className="text-[10px] text-brand-600">当前</span>}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>{cell}</TooltipTrigger>
                                <TooltipContent side="top" className="max-w-56 bg-ink-900 text-xs text-white">
                                  <p className="font-semibold">{ACCESS_LABEL[level]}</p>
                                  {note && <p className="mt-0.5 text-white/70">{note}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
