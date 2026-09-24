/**
 * PviScatter — 全队 PVI vs 30m 冲刺四象限散点（combo-testing.md §5）
 * X=30m(s) Y=PVI；象限分割 PVI 75 / 30m 4.20s；趋势虚线；点按年龄组着色
 */

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Line, ResponsiveContainer,
} from 'recharts';
import { ATHLETES, AGE_GROUPS, GROUP_COLOR } from '@/data/athletes';
import type { ComboRecord } from '@/data';

interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  group: string;
}

/** 最小二乘趋势线的两个端点 */
function trendLine(points: ScatterPoint[]): { x: number; y: number }[] {
  if (points.length < 2) return [];
  const n = points.length;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return [];
  const k = (n * sxy - sx * sy) / denom;
  const b = (sy - k * sx) / n;
  const xs = points.map((p) => p.x);
  const x1 = Math.min(...xs) - 0.01;
  const x2 = Math.max(...xs) + 0.01;
  return [
    { x: Number(x1.toFixed(3)), y: Number((k * x1 + b).toFixed(1)) },
    { x: Number(x2.toFixed(3)), y: Number((k * x2 + b).toFixed(1)) },
  ];
}

const QUADRANTS = [
  { label: '力量型待转化', pos: 'left-3 top-3' },        // 左上：冲刺慢 + PVI 高
  { label: '精英区', pos: 'right-3 top-3' },             // 右上
  { label: '待发展', pos: 'left-3 bottom-10' },          // 左下
  { label: '速度型', pos: 'right-3 bottom-10' },         // 右下
];

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-[10px] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-lift">
      <p className="font-semibold">{p.name} <span className="font-mono-data text-slate-400">{p.group}</span></p>
      <p className="mt-1 font-mono-data">30m {p.x.toFixed(2)}s · PVI {p.y}</p>
    </div>
  );
}

interface PviScatterProps {
  records: ComboRecord[];
}

export default function PviScatter({ records }: PviScatterProps) {
  const byGroup = AGE_GROUPS.map((g) => ({
    group: g,
    color: GROUP_COLOR[g],
    points: records
      .filter((r) => ATHLETES.find((a) => a.id === r.athleteId)?.group === g)
      .map((r) => ({
        x: r.sprint30m,
        y: r.pvi,
        name: ATHLETES.find((a) => a.id === r.athleteId)?.name ?? r.athleteId,
        group: g,
      })),
  })).filter((g) => g.points.length > 0);

  const all = byGroup.flatMap((g) => g.points);
  const trend = trendLine(all);

  return (
    <section className="rounded-[14px] border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3>全队 PVI vs 30m 冲刺散点</h3>
          <p className="mt-0.5 text-xs text-text-3">象限分割：PVI 75 / 30m 4.20s · 点色 = 年龄组</p>
        </div>
        <div className="flex items-center gap-3">
          {byGroup.map((g) => (
            <span key={g.group} className="flex items-center gap-1 text-[11px] text-text-2">
              <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
              {g.group}
            </span>
          ))}
        </div>
      </div>
      <div className="relative p-5">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#EEF2F7" strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              reversed
              domain={['dataMin - 0.03', 'dataMax + 0.03']}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(2)}
              name="30m"
              label={{ value: '30m 冲刺 (s)', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#94A3B8' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={['dataMin - 4', 'dataMax + 4']}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              name="PVI"
              label={{ value: 'PVI', position: 'insideTopLeft', offset: -8, fontSize: 11, fill: '#94A3B8' }}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#94A3B8' }} />
            <ReferenceLine y={75} stroke="#94A3B8" strokeDasharray="6 4" />
            <ReferenceLine x={4.2} stroke="#94A3B8" strokeDasharray="6 4" />
            {trend.length === 2 && (
              <Line data={trend} dataKey="y" stroke="#2563EB" strokeDasharray="8 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            )}
            {byGroup.map((g) => (
              <Scatter key={g.group} name={g.group} data={g.points} fill={g.color} line={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        {/* 四象限标签 */}
        {QUADRANTS.map((q) => (
          <span
            key={q.label}
            className={`pointer-events-none absolute ${q.pos} rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-medium text-text-3`}
          >
            {q.label}
          </span>
        ))}
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-text-3">
        PVI 高但冲刺慢 = 力量未转化；建议加强弹性-速度训练链
      </p>
    </section>
  );
}
