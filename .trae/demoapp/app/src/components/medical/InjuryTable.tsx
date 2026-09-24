/**
 * InjuryTable — 伤病台账表（medical.md §3.1 左卡）
 * 状态 chip 过滤 + 部位/程度下拉 + 搜索；非队医角色诊断脱敏
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AgeBadge } from '@/components/common';
import {
  INJURIES, RTP_STAGES, getAthlete, injuryStats,
  type Injury, type InjurySeverity, type InjuryStatus,
} from '@/data';
import RtpMiniProgress from '@/components/health/RtpMiniProgress';
import { shortDate } from '@/components/health/healthUtils';

interface InjuryTableProps {
  /** 脱敏模式（coach/fitness）：隐藏诊断与机制列 */
  masked: boolean;
  stageOverrides: Record<string, number>;
  onOpen: (injury: Injury) => void;
}

type StatusFilter = 'all' | InjuryStatus;

const SEVERITY_STYLE: Record<InjurySeverity, { color: string; bg: string; border: string }> = {
  轻: { color: '#16A34A', bg: '#E8F7EE', border: '#B7E4C7' },
  中: { color: '#D97706', bg: '#FEF3E0', border: '#F5D9A8' },
  重: { color: '#DC2626', bg: '#FCEBEB', border: '#F3C1C1' },
};

/** 活跃行左侧 3px 色边按 activeKind */
const ACTIVE_EDGE: Record<string, string> = {
  停训: '#DC2626',
  限制: '#D97706',
  带伤训练: '#2563EB',
  监控中: '#8B5CF6',
};

export default function InjuryTable({ masked, stageOverrides, onOpen }: InjuryTableProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [site, setSite] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [q, setQ] = useState('');

  const stats = useMemo(() => injuryStats(), []);
  const siteOptions = useMemo(() => Array.from(new Set(INJURIES.map((i) => i.site))), []);

  const rows = useMemo(() => {
    return INJURIES.filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (site !== 'all' && i.site !== site) return false;
      if (severity !== 'all' && i.severity !== severity) return false;
      if (q.trim()) {
        const a = getAthlete(i.athleteId);
        const hay = `${a?.name ?? ''}${i.type}${i.site}${i.id}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (a.status === b.status ? (a.date < b.date ? 1 : -1) : a.status === 'active' ? -1 : 1));
  }, [status, site, severity, q]);

  const chips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: INJURIES.length },
    { key: 'active', label: '活跃', count: stats.active },
    { key: 'recovered', label: '已康复', count: stats.recovered },
  ];

  return (
    <div className="rounded-[14px] border border-line bg-white shadow-card lg:col-span-8">
      {/* 过滤条 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatus(c.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === c.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-white text-text-2 hover:border-brand-500 hover:text-brand-600',
            )}
          >
            {c.label} <span className="font-mono-data tnum">{c.count}</span>
          </button>
        ))}
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="h-7 rounded-lg border border-line bg-white px-2 text-xs text-text-2 outline-none focus:border-brand-500"
        >
          <option value="all">全部部位</option>
          {siteOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-7 rounded-lg border border-line bg-white px-2 text-xs text-text-2 outline-none focus:border-brand-500"
        >
          <option value="all">全部程度</option>
          <option value="轻">轻</option>
          <option value="中">中</option>
          <option value="重">重</option>
        </select>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索运动员 / 诊断…"
            className="h-7 w-44 rounded-lg border border-line pl-7 pr-2 text-xs outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* 表格 */}
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-text-3">
              <th className="px-4 py-2.5 font-semibold">运动员</th>
              {!masked && <th className="px-2 py-2.5 font-semibold">诊断</th>}
              <th className="px-2 py-2.5 font-semibold">部位</th>
              {!masked && <th className="px-2 py-2.5 font-semibold">机制</th>}
              <th className="px-2 py-2.5 font-semibold">程度</th>
              {!masked && <th className="px-2 py-2.5 font-semibold">伤发日期</th>}
              <th className="px-2 py-2.5 font-semibold" style={{ minWidth: 150 }}>RTP 阶段</th>
              <th className="px-2 py-2.5 text-right font-semibold">预计复出</th>
              <th className="px-3 py-2.5 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inj, i) => {
              const a = getAthlete(inj.athleteId);
              const recovered = inj.status === 'recovered';
              const stage = stageOverrides[inj.id] ?? inj.rtpStage;
              const sev = SEVERITY_STYLE[inj.severity];
              return (
                <motion.tr
                  key={inj.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.45), duration: 0.2 }}
                  onClick={() => onOpen(inj)}
                  className={cn(
                    'cursor-pointer border-b border-line/60 transition-colors duration-100 last:border-0 hover:bg-[#F8FAFF]',
                    recovered && 'opacity-60',
                  )}
                  style={{ boxShadow: !recovered ? `inset 3px 0 0 ${ACTIVE_EDGE[inj.activeKind ?? ''] ?? '#2563EB'}` : undefined }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={a?.name ?? '?'} group={a?.group} size={28} />
                      <div>
                        <p className="text-sm font-medium leading-4 text-text-1">{a?.name}</p>
                        <AgeBadge group={a?.group ?? 'U18'} className="mt-0.5 scale-90" />
                      </div>
                    </div>
                  </td>
                  {!masked && (
                    <td className="max-w-[180px] px-2 py-2.5">
                      <p className="truncate text-sm font-medium text-text-1" title={inj.type}>{inj.type}</p>
                      <p className="font-mono-data text-[10px] text-text-3">{inj.id}</p>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-2 py-2.5 text-xs text-text-2">{inj.site}</td>
                  {!masked && <td className="whitespace-nowrap px-2 py-2.5 text-xs text-text-2">{inj.mechanism}</td>}
                  <td className="px-2 py-2.5">
                    <span
                      className="rounded-full border px-1.5 py-px text-[11px] font-medium"
                      style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
                    >
                      {inj.severity}
                    </span>
                  </td>
                  {!masked && <td className="whitespace-nowrap px-2 py-2.5 font-mono-data text-xs text-text-2 tnum">{inj.date}</td>}
                  <td className="px-2 py-2.5">
                    {recovered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
                        <Check className="h-3.5 w-3.5" /> 已复出
                      </span>
                    ) : (
                      <div className="w-36">
                        <RtpMiniProgress stage={stage} showLabel={false} />
                        <p className="mt-0.5 font-mono-data text-[10px] text-text-3 tnum">{stage}/4 · {RTP_STAGES[stage]}</p>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono-data text-xs text-text-1 tnum">
                    {shortDate(inj.estReturn)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600">
                      详情 <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </td>
                </motion.tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-text-3">
                  当前筛选条件下没有匹配的伤病记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
