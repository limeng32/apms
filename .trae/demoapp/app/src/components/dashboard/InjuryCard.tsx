/**
 * InjuryCard — 伤病台账摘要（dashboard.md §4.1）
 * 数据：injuryStats()/siteDistribution()/activeInjuries()/getAthlete()
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '@/components/common';
import { activeInjuries, getAthlete, injuryStats, siteDistribution } from '@/data';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import DashTooltip from './DashTooltip';
import { BIG_CARD, axisProps  } from './theme';

/** 部位柱色：按数量由青 → 红渐变 */
function siteColor(count: number, max: number): string {
  const t = max <= 1 ? 0 : (count - 1) / (max - 1);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  // #06B6D4 → #DC2626
  return `rgb(${lerp(0x06, 0xdc)}, ${lerp(0xb6, 0x26)}, ${lerp(0xd4, 0x26)})`;
}

const SITE_ORDER = ['大腿', '膝', '踝', '腹股沟', '其他'];

export default function InjuryCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();
  const { role } = useRole();
  const stats = injuryStats();

  // 本月新发（2025-06 起、停训/限制口径）：INJ02 / INJ04 / INJ05
  const newThisMonth = useMemo(
    () =>
      activeInjuries().filter(
        (i) => i.date >= '2025-06-01' && (i.activeKind === '停训' || i.activeKind === '限制'),
      ).length,
    [],
  );

  const sites = useMemo(() => {
    const dist = [...siteDistribution()].sort(
      (a, b) => SITE_ORDER.indexOf(a.site) - SITE_ORDER.indexOf(b.site),
    );
    const max = Math.max(...dist.map((d) => d.count));
    return dist.map((d) => ({ ...d, color: siteColor(d.count, max) }));
  }, []);

  // 最近 2 条活跃伤病（停训优先：周子昂 / 罗一帆）
  const recent = useMemo(
    () =>
      activeInjuries()
        .filter((i) => i.activeKind === '停训')
        .map((i) => ({ injury: i, athlete: getAthlete(i.athleteId) }))
        .slice(0, 2),
    [],
  );

  const footer =
    role === 'fitness' ? (
      <button
        onClick={() => navigate('/health')}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
      >
        查看 RTP 状态
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    ) : (
      <button
        onClick={() => navigate('/medical')}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
      >
        进入医疗康复
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    );

  return (
    <ChartCard
      title="伤病台账摘要"
      className={cn(className, big && BIG_CARD)}
      bodyClassName="pt-4"
      actions={footer}
    >
      {/* 顶部统计行 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '活跃', value: stats.active, cls: big ? 'text-[#FBBF24]' : 'text-warn' },
          { label: '本月新发', value: newThisMonth, cls: big ? 'text-[#F87171]' : 'text-risk' },
          { label: '已康复', value: stats.recovered, cls: big ? 'text-[#4ADE80]' : 'text-ok' },
        ].map((s) => (
          <div
            key={s.label}
            className={cn('rounded-[10px] px-2.5 py-2 text-center', big ? 'bg-white/5' : 'bg-slate-50')}
          >
            <p className={cn('font-mono-data text-xl font-bold tnum', s.cls)}>{s.value}</p>
            <p className={cn('mt-0.5 text-[11px]', big ? 'text-white/50' : 'text-text-3')}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 部位分布横条 */}
      <div className="mt-3 h-[132px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sites} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap="30%">
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="site" width={44} {...axisProps(!!big)} />
            <Tooltip
              cursor={{ fill: big ? 'rgba(255,255,255,0.04)' : '#F8FAFF' }}
              content={
                <DashTooltip
                  title={(label) => `部位 · ${label}`}
                  formatter={(item) => ({ name: '伤病记录', value: `${item.value} 条`, color: item.payload?.color as string })}
                />
              }
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={700} barSize={14}>
              {sites.map((d) => (
                <Cell key={d.site} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 最近活跃伤病 mini 列表 */}
      <div className={cn('mt-2 flex flex-col gap-1.5 border-t pt-3', big ? 'border-ink-700' : 'border-line')}>
        {recent.map(({ injury, athlete }) => (
          <button
            key={injury.id}
            onClick={() => navigate(`/medical?injury=${injury.id}`)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
              big ? 'hover:bg-white/5' : 'hover:bg-[#F8FAFF]',
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-50 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-warn" />
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-xs', big ? 'text-white/80' : 'text-text-2')}>
              <span className={cn('font-medium', big ? 'text-white' : 'text-text-1')}>{athlete?.name}</span>
              {' · '}
              {injury.type}
            </span>
            <span className="shrink-0 font-mono-data text-[11px] font-semibold text-warn tnum">
              RTP {injury.rtpStage}/4期
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
