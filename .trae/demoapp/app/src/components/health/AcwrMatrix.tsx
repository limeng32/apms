/**
 * AcwrMatrix — 全队 ACWR 风险矩阵散点图（health-warning.md §4.1 左卡）
 * X=慢性负荷（28 天滚动 AU），Y=ACWR；甜区/高风险/危险分区着色
 */

import { useMemo } from 'react';
import {
  CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartCard } from '@/components/common';
import {
  ATHLETES, ATHLETE_ACWR, TEAM_ACWR, CURRENT_WEEK, acwrZone,
  type Athlete,
} from '@/data';
import { seededHash } from './healthUtils';

export interface MatrixPoint {
  id: string;
  name: string;
  group: Athlete['group'];
  x: number;
  y: number;
  focus: boolean;
  estimated: boolean;
}

const ZONE_FILL: Record<'green' | 'amber' | 'red', string> = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
};

/** 非重点运动员慢性负荷演示估算：按年龄组基准 + 确定性抖动（仅供散点分布演示） */
const GROUP_CHRONIC_BASE: Record<Athlete['group'], number> = {
  U13: 1650, U14: 1800, U15: 1950, U16: 2100, U17: 2250, U18: 2350,
};

export function buildMatrixPoints(): MatrixPoint[] {
  const points: MatrixPoint[] = [];
  for (const a of ATHLETES) {
    const series = ATHLETE_ACWR[a.id];
    if (series) {
      const last = series[series.length - 1];
      points.push({ id: a.id, name: a.name, group: a.group, x: last.chronic, y: last.acwr, focus: true, estimated: false });
    } else if (a.acwr !== null) {
      const x = Math.round(GROUP_CHRONIC_BASE[a.group] * (0.94 + seededHash(a.id) * 0.12));
      points.push({ id: a.id, name: a.name, group: a.group, x, y: a.acwr, focus: false, estimated: true });
    }
  }
  return points;
}

interface AcwrMatrixProps {
  onHover: (athleteId: string | null) => void;
}

export default function AcwrMatrix({ onHover }: AcwrMatrixProps) {
  const points = useMemo(buildMatrixPoints, []);
  const focus = points.filter((p) => p.focus);
  const others = points.filter((p) => !p.focus);
  const teamChronic = TEAM_ACWR[TEAM_ACWR.length - 1].chronic;

  return (
    <ChartCard
      title="全队 ACWR 风险矩阵"
      subtitle={`X=慢性负荷（28 天滚动 AU）· Y=ACWR · 截至 ${CURRENT_WEEK} 当周`}
      className="lg:col-span-7"
    >
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 64, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#EEF2F7" strokeDasharray="4 4" vertical={false} />
            <XAxis
              type="number" dataKey="x" name="慢性负荷" domain={[1200, 3000]}
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
            />
            <YAxis
              type="number" dataKey="y" name="ACWR" domain={[0, 2]} ticks={[0.5, 0.8, 1.0, 1.3, 1.5, 2.0]}
              tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
            />
            {/* 分区背景 */}
            <ReferenceArea y1={0.8} y2={1.3} fill="#16A34A" fillOpacity={0.07}
              label={{ value: '最佳区间 0.8–1.3', position: 'insideTopRight', fontSize: 11, fill: '#16A34A' }} />
            <ReferenceArea y1={1.3} y2={1.5} fill="#D97706" fillOpacity={0.08}
              label={{ value: '高风险 1.3–1.5', position: 'insideTopRight', fontSize: 11, fill: '#D97706' }} />
            <ReferenceArea y1={1.5} y2={2} fill="#DC2626" fillOpacity={0.08}
              label={{ value: '危险 >1.5', position: 'insideTopRight', fontSize: 11, fill: '#DC2626' }} />
            <ReferenceArea y1={0} y2={0.8} fill="#D97706" fillOpacity={0.05}
              label={{ value: '负荷不足 <0.8', position: 'insideBottomRight', fontSize: 11, fill: '#D97706' }} />
            <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#CBD5E1' }} />
            {/* 其余运动员淡灰点 */}
            <Scatter data={others} fill="#CBD5E1" opacity={0.7} />
            {/* 8 名重点运动员，按状态着色 */}
            <Scatter
              data={focus}
              onMouseEnter={(d: unknown) => {
                const p = (d as { payload?: MatrixPoint }).payload ?? (d as MatrixPoint);
                onHover(p?.id ?? null);
              }}
              onMouseLeave={() => onHover(null)}
            >
              {focus.map((p) => (
                <Cell key={p.id} fill={ZONE_FILL[acwrZone(p.y)]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-text-3">
        ACWR = 急性负荷（7 天）/ 慢性负荷（28 天滚动均值）· 甜蜜区 0.8–1.3 · 全队平均慢性负荷约 {teamChronic} AU · 灰点为非重点运动员（慢性负荷按年龄组估算，仅供分布演示）
      </p>
    </ChartCard>
  );
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: MatrixPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const zone = acwrZone(p.y);
  const zoneLabel = zone === 'red' ? '危险' : zone === 'amber' ? (p.y < 0.8 ? '负荷不足' : '高风险') : '最佳区间';
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.focus ? ZONE_FILL[zone] : '#94A3B8' }} />
        {p.name} <span className="font-normal text-slate-400">{p.group}</span>
      </p>
      <p className="mt-1 font-mono-data tnum">
        慢性 {p.x} AU{p.estimated ? '（估算）' : ''} · ACWR {p.y.toFixed(2)} · {zoneLabel}
      </p>
    </div>
  );
}
