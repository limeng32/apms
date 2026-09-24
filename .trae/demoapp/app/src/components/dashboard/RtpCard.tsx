/**
 * RtpCard — 参训风险分布（RTP）：环形 Donut + 按年龄组堆叠横条（dashboard.md §3.1）
 * 数据：rtpSummary() + ATHLETES 按年龄组推导；图例点击跳 /health 带过滤参数
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/common';
import { AGE_GROUPS, ATHLETES, rtpSummary } from '@/data';
import { cn } from '@/lib/utils';
import DashTooltip from './DashTooltip';
import { BIG_CARD, STATUS, axisProps  } from './theme';

const PIE_DATA_META = [
  { key: 'green' as const, name: '可参训', color: STATUS.green },
  { key: 'amber' as const, name: '限制参训', color: STATUS.amber },
  { key: 'red' as const, name: '停训', color: STATUS.red },
];

export default function RtpCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();
  const summary = rtpSummary();
  const total = summary.green + summary.amber + summary.red;
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const pieData = useMemo(
    () => PIE_DATA_META.map((m) => ({ ...m, value: summary[m.key] })),
    [summary.green, summary.amber, summary.red], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const groupData = useMemo(
    () =>
      AGE_GROUPS.map((g) => {
        const list = ATHLETES.filter((a) => a.group === g);
        return {
          group: g,
          green: list.filter((a) => a.rtp === 'green').length,
          amber: list.filter((a) => a.rtp === 'amber').length,
          red: list.filter((a) => a.rtp === 'red').length,
        };
      }),
    [],
  );

  const goHealth = (status?: string) => navigate(status ? `/health?rtp=${status}` : '/health');

  return (
    <ChartCard
      title="参训风险分布（RTP）"
      subtitle="红黄绿三态 · 点击图例查看明细"
      className={cn(className, big && BIG_CARD)}
      bodyClassName="pt-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* 左：Donut */}
        <div className="relative mx-auto h-[196px] w-[196px] shrink-0">
          {big && (
            <span className="absolute inset-2 rounded-full border border-brand-500/30 shadow-[0_0_32px_rgba(37,99,235,.25)]" />
          )}
          <PieChart width={196} height={196}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="88%"
              strokeWidth={big ? 2 : 0}
              stroke={big ? '#111B31' : undefined}
              animationDuration={700}
              onMouseEnter={(_, i) => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(-1)}
            >
              {pieData.map((d, i) => (
                <Cell
                  key={d.key}
                  fill={d.color}
                  style={{
                    transform: activeIdx === i ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'transform 150ms ease-out',
                    cursor: 'pointer',
                  }}
                  onClick={() => goHealth(d.key)}
                />
              ))}
            </Pie>
            <Tooltip
              content={
                <DashTooltip
                  formatter={(item) => ({
                    name: String(item.name ?? ''),
                    value: `${item.value} 人`,
                    color: item.color,
                  })}
                />
              }
            />
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-mono-data text-3xl font-bold tnum', big ? 'text-white' : 'text-text-1')}>
              {total}
            </span>
            <span className={cn('text-xs', big ? 'text-white/50' : 'text-text-3')}>在训</span>
          </div>
        </div>

        {/* 右：按年龄组堆叠横条 */}
        <div className="h-[196px] min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
              <XAxis type="number" hide domain={[0, 4]} />
              <YAxis type="category" dataKey="group" width={36} {...axisProps(!!big)} />
              <Tooltip
                cursor={{ fill: big ? 'rgba(255,255,255,0.04)' : '#F8FAFF' }}
                content={
                  <DashTooltip
                    title={(label) => `${label} 年龄组`}
                    formatter={(item) => ({
                      name:
                        item.name === 'green' ? '可参训' : item.name === 'amber' ? '限制参训' : '停训',
                      value: `${item.value} 人`,
                      color:
                        item.name === 'green'
                          ? STATUS.green
                          : item.name === 'amber'
                            ? STATUS.amber
                            : STATUS.red,
                    })}
                  />
                }
              />
              <Bar dataKey="green" stackId="rtp" fill={STATUS.green} animationDuration={700} />
              <Bar dataKey="amber" stackId="rtp" fill={STATUS.amber} animationDuration={700} />
              <Bar dataKey="red" stackId="rtp" fill={STATUS.red} radius={[0, 6, 6, 0]} animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 底部图例行 */}
      <div className={cn('mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3', big ? 'border-ink-700' : 'border-line')}>
        {PIE_DATA_META.map((m) => (
          <button
            key={m.key}
            onClick={() => goHealth(m.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors',
              big ? 'text-white/70 hover:bg-white/5' : 'text-text-2 hover:bg-slate-50',
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            {m.name}
            <span className="font-mono-data font-semibold tnum">{summary[m.key]}</span>
          </button>
        ))}
        <button
          onClick={() => goHealth('red')}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
        >
          红/黄名单 · 查看详情
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </ChartCard>
  );
}
