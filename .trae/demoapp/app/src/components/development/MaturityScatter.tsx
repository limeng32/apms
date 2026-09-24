/**
 * MaturityScatter — 成熟度分布矩阵（development.md §3.1 左卡，核心图）
 * X=成熟度偏移（岁），Y=当前身高；按年龄组取色；分区带 + 年龄组均值参考线 + 组过滤 chip
 */

import { useMemo, useState } from 'react';
import {
  CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/common';
import { ATHLETES, AGE_GROUPS, GROUP_COLOR, maturityBand, type AgeGroup, type Athlete } from '@/data';

interface MaturityScatterProps {
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

export default function MaturityScatter({ hoveredId, onHover }: MaturityScatterProps) {
  const [groups, setGroups] = useState<AgeGroup[]>([...AGE_GROUPS]);
  const [showAvgLines, setShowAvgLines] = useState(true);

  const visible = useMemo(() => ATHLETES.filter((a) => groups.includes(a.group)), [groups]);

  const avgByGroup = useMemo(() => {
    const m = new Map<AgeGroup, number>();
    for (const g of AGE_GROUPS) {
      const list = ATHLETES.filter((a) => a.group === g);
      m.set(g, Math.round((list.reduce((s, a) => s + a.height, 0) / list.length) * 10) / 10);
    }
    return m;
  }, []);

  const toggle = (g: AgeGroup) =>
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  return (
    <ChartCard
      title="成熟度分布矩阵"
      subtitle="X=成熟度偏移（岁）· Y=当前身高（cm）· 点按年龄组取色"
      className="lg:col-span-7"
      actions={
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
          <input type="checkbox" checked={showAvgLines} onChange={(e) => setShowAvgLines(e.target.checked)} className="accent-brand-600" />
          组均身高线
        </label>
      }
    >
      {/* 年龄组过滤 chip */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {AGE_GROUPS.map((g) => {
          const on = groups.includes(g);
          return (
            <button
              key={g}
              onClick={() => toggle(g)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono-data text-xs font-medium transition-all',
                on ? 'text-white' : 'bg-white text-text-3 opacity-50',
              )}
              style={on ? { background: GROUP_COLOR[g], borderColor: GROUP_COLOR[g] } : { borderColor: '#E5E9F0' }}
            >
              {g}
            </button>
          );
        })}
      </div>

      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#EEF2F7" strokeDasharray="4 4" vertical={false} />
            <XAxis
              type="number" dataKey="maturityOffset" name="成熟度偏移" domain={[-2.5, 2]}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
            />
            <YAxis
              type="number" dataKey="height" name="身高" domain={[145, 195]} unit=""
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
            />
            {/* 分区：晚熟 / 正常 / 早熟 */}
            <ReferenceArea x1={-1} x2={1} fill="#2563EB" fillOpacity={0.06}
              label={{ value: '正常发育区间', position: 'insideTop', fontSize: 11, fill: '#2563EB' }} />
            <ReferenceArea x1={-2.5} x2={-1} fill="#8B5CF6" fillOpacity={0.07}
              label={{ value: '晚熟区', position: 'insideTop', fontSize: 11, fill: '#8B5CF6' }} />
            <ReferenceArea x1={1} x2={2} fill="#F59E0B" fillOpacity={0.08}
              label={{ value: '早熟区', position: 'insideTop', fontSize: 11, fill: '#B45309' }} />
            {/* 各年龄组平均身高虚线 */}
            {showAvgLines &&
              AGE_GROUPS.map((g) => (
                <ReferenceLine key={g} y={avgByGroup.get(g)} stroke={GROUP_COLOR[g]} strokeDasharray="4 4" strokeOpacity={0.45} />
              ))}
            <Tooltip content={<MaturityTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#CBD5E1' }} />
            {AGE_GROUPS.filter((g) => groups.includes(g)).map((g) => (
              <Scatter
                key={g}
                data={visible.filter((a) => a.group === g)}
                fill={GROUP_COLOR[g]}
                onMouseEnter={(d: unknown) => {
                  const p = (d as { payload?: Athlete }).payload ?? (d as Athlete);
                  onHover(p?.id ?? null);
                }}
                onMouseLeave={() => onHover(null)}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-text-3">
        成熟度偏移 = 当前年龄 − 预测 PHV 年龄；负值 = 尚未达到身高增长高峰
        {hoveredId && <span className="ml-2 text-brand-600">已联动右侧分组卡</span>}
      </p>
    </ChartCard>
  );
}

function MaturityTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: Athlete }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const a = payload[0].payload;
  const band = maturityBand(a);
  const bandLabel = band === 'late' ? '晚熟' : band === 'early' ? '早熟' : '正常';
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_COLOR[a.group] }} />
        {a.name} <span className="font-normal text-slate-400">{a.group} · {bandLabel}</span>
      </p>
      <p className="mt-1 font-mono-data tnum">
        偏移 {a.maturityOffset > 0 ? '+' : ''}{a.maturityOffset} 岁 · {a.height}cm · 预测 {a.predictedHeight}cm
      </p>
    </div>
  );
}
