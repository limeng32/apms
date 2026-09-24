/**
 * GrowthChart — 身高增长速度追踪（development.md §5.2 右卡）
 * 4 名 PHV 敏感期运动员 · 近 12 月（模型推导实测）+ 未来 6 月预测（虚线）· 身高/增速双模式
 */

import { useMemo, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/common';
import { getAthlete, PHV_WATCH_IDS, type Athlete } from '@/data';
import { growthSeries } from './devUtils';

type Mode = 'height' | 'velocity';

const SERIES_COLOR: Record<string, string> = {
  A11: '#22C55E', // 朱天佑
  A13: '#3B82F6', // 林沐阳
  A16: '#F59E0B', // 何景行
  A19: '#06B6D4', // 唐子睿
};

/** '25-06' 月份标签平移 n 个月 */
function shiftMonth(label: string, n: number): string {
  const y = 2000 + Number(label.slice(0, 2));
  const m = Number(label.slice(3));
  const d = new Date(y, m - 1 + n, 1);
  return `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function GrowthChart() {
  const [mode, setMode] = useState<Mode>('height');

  const athletes = useMemo(() => PHV_WATCH_IDS.map((id) => getAthlete(id)).filter((a): a is Athlete => !!a), []);
  const seriesById = useMemo(() => {
    const m: Record<string, ReturnType<typeof growthSeries>> = {};
    for (const a of athletes) m[a.id] = growthSeries(a);
    return m;
  }, [athletes]);

  /**
   * 合并为 Recharts 行数据：
   * `A11` = 历史段（含当前月），`A11P` = 预测段（从当前月起桥接，虚线）
   */
  const { rows, months, CUR } = useMemo(() => {
    const first = athletes[0] ? seriesById[athletes[0].id] : [];
    const months = first.map((p) => p.month);
    const CUR = first.findIndex((p) => p.future) - 1; // 当前月索引
    const rows = months.map((month, i) => {
      const row: Record<string, string | number> = { month };
      for (const a of athletes) {
        const pt = seriesById[a.id][i];
        const v = mode === 'height' ? pt.height : pt.velocity;
        if (i <= CUR) row[a.id] = v;
        if (i >= CUR) row[`${a.id}P`] = v;
      }
      return row;
    });
    return { rows, months, CUR };
  }, [athletes, seriesById, mode]);

  const todayLabel = months[CUR];
  const axisStart = months[0];
  const axisEnd = months[months.length - 1];

  /** PHV 预测区间带（PHV 月 ±0.5 岁），裁剪到轴范围；完全超出右缘则仅贴边提示 */
  const phvBands = athletes.map((a) => {
    const monthsToPhv = Math.round(-a.maturityOffset * 12);
    const phv = shiftMonth(todayLabel, monthsToPhv);
    const raw1 = shiftMonth(phv, -6);
    const raw2 = shiftMonth(phv, 6);
    return {
      id: a.id,
      x1: raw1 < axisStart ? axisStart : raw1 > axisEnd ? axisEnd : raw1,
      x2: raw2 > axisEnd ? axisEnd : raw2 < axisStart ? axisStart : raw2,
      phv,
    };
  });

  return (
    <ChartCard
      title="身高增长速度追踪"
      subtitle="4 名 PHV 敏感期重点监控运动员 · 实线=近 12 月 · 虚线=未来 6 月预测（PHV 模型推导）"
      className="lg:col-span-7"
      actions={
        <div className="flex rounded-lg border border-line p-0.5">
          {([['height', '身高 cm'], ['velocity', '增速 cm/年']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                mode === m ? 'bg-brand-600 text-white' : 'text-text-2 hover:text-brand-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#EEF2F7" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={2} />
            <YAxis
              domain={mode === 'height' ? ['dataMin - 3', 'dataMax + 3'] : [3, 11]}
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
            />
            <Tooltip content={<GrowthTooltip unit={mode === 'height' ? 'cm' : 'cm/年'} />} />
            {/* 各人 PHV 预测区间带（±0.5 岁，半透明紫） */}
            {phvBands.map((b) => (
              <ReferenceArea key={b.id} x1={b.x1} x2={b.x2} fill="#8B5CF6" fillOpacity={0.07} />
            ))}
            {todayLabel && (
              <ReferenceLine x={todayLabel} stroke="#94A3B8" strokeDasharray="4 3"
                label={{ value: '今天', position: 'insideTopRight', fontSize: 11, fill: '#94A3B8' }} />
            )}
            {athletes.map((a) => (
              <Line
                key={a.id}
                type="monotone"
                dataKey={a.id}
                name={a.name}
                stroke={SERIES_COLOR[a.id]}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            ))}
            {athletes.map((a) => (
              <Line
                key={`${a.id}P`}
                type="monotone"
                dataKey={`${a.id}P`}
                name={`${a.name}（预测）`}
                stroke={SERIES_COLOR[a.id]}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.55}
                dot={false}
                connectNulls
                legendType="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {athletes.map((a, i) => (
          <span key={a.id} className="flex items-center gap-1.5 text-xs text-text-2">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLOR[a.id] }} />
            {a.name} · PHV 预测 {a.phvAge.toFixed(1)} 岁（{phvBands[i].phv}）
          </span>
        ))}
        <span className="ml-auto text-[11px] text-text-3">紫色带 = 各人 PHV ±0.5 岁预测区间</span>
      </div>
    </ChartCard>
  );
}

function GrowthTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: string | number; value?: number | string; name?: string }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <p className="font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5 font-mono-data tnum">
          {p.name}：{p.value} {unit}
        </p>
      ))}
    </div>
  );
}
