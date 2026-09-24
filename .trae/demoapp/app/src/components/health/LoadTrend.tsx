/**
 * LoadTrend — 重点运动员负荷趋势对比（health-warning.md §4.2 底部通栏）
 * 柱=周负荷（AU），线=ACWR，甜区 ReferenceArea，事件注释 ReferenceLine
 */

import { useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/common';
import {
  ATHLETE_ACWR, getAthlete, injuriesByAthlete, acwrZone, type AcwrPoint,
} from '@/data';
import { weekBucketOf } from './healthUtils';

const FOCUS_IDS = Object.keys(ATHLETE_ACWR);

interface TrendRow {
  week: string;
  acute: number;
  acwr: number;
}

export default function LoadTrend() {
  const [selected, setSelected] = useState('A23');

  const data: TrendRow[] = useMemo(
    () => ATHLETE_ACWR[selected].map((p: AcwrPoint) => ({ week: p.week.slice(5), acute: p.acute, acwr: p.acwr })),
    [selected],
  );

  /** 事件注释：A23 新入队负荷激增（Week 23）；其余取活跃伤病的伤发周 */
  const annotation = useMemo(() => {
    if (selected === 'A23') return { week: '06-02', label: 'Week 23 · 新入队负荷激增', color: '#DC2626' };
    const inj = injuriesByAthlete(selected).find((i) => i.status === 'active');
    if (inj) {
      const bucket = weekBucketOf(inj.date);
      if (bucket) return { week: bucket.slice(5), label: inj.type, color: '#D97706' };
    }
    return null;
  }, [selected]);

  const athlete = getAthlete(selected);

  return (
    <ChartCard
      title="重点运动员负荷趋势对比"
      subtitle={athlete ? `${athlete.name} · ${athlete.group} · 柱=周负荷 AU（左轴）· 线=ACWR（右轴）` : undefined}
      className="mt-5"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_IDS.map((id) => {
            const a = getAthlete(id);
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  selected === id
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line bg-white text-text-2 hover:border-brand-500 hover:text-brand-600',
                )}
              >
                {a?.name}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#EEF2F7" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="load" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="ratio" orientation="right" domain={[0, 2]} ticks={[0.8, 1.0, 1.3, 1.5]}
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
            {/* 甜蜜区（右轴 0.8–1.3） */}
            <ReferenceArea yAxisId="ratio" y1={0.8} y2={1.3} fill="#16A34A" fillOpacity={0.07}
              label={{ value: '甜蜜区', position: 'insideTopLeft', fontSize: 11, fill: '#16A34A' }} />
            {annotation && (
              <ReferenceLine yAxisId="load" x={annotation.week} stroke={annotation.color} strokeDasharray="4 3"
                label={{ value: annotation.label, position: 'top', fontSize: 11, fill: annotation.color }} />
            )}
            <Bar yAxisId="load" dataKey="acute" name="周负荷" fill="#3B82F6" fillOpacity={0.85} radius={[6, 6, 0, 0]} barSize={22} />
            <Line yAxisId="ratio" type="monotone" dataKey="acwr" name="ACWR" stroke="#0F172A" strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload?: TrendRow; index?: number }) => {
                const { cx, cy, payload, index } = props;
                if (cx === undefined || cy === undefined || !payload) return <g key={index} />;
                return <circle key={index} cx={cx} cy={cy} r={4} fill={zoneColor(payload.acwr)} stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-text-3">
        绿带 = ACWR 甜蜜区 0.8–1.3；数据点按当周 ACWR 状态着色（绿 0.8–1.3 / 黄 &lt;0.8 或 1.3–1.5 / 红 &gt;1.5）
      </p>
    </ChartCard>
  );
}

function zoneColor(v: number): string {
  const z = acwrZone(v);
  return z === 'red' ? '#DC2626' : z === 'amber' ? '#D97706' : '#16A34A';
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { dataKey?: string; value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const acute = payload.find((p) => p.dataKey === 'acute')?.value;
  const acwr = payload.find((p) => p.dataKey === 'acwr')?.value;
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <p className="font-semibold">周一开始 {label}</p>
      <p className="mt-1 font-mono-data tnum">周负荷 {acute} AU · ACWR {acwr?.toFixed(2)}</p>
    </div>
  );
}
