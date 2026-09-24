/**
 * MainChart — 趋势页主图（trends.md §3）
 * 多运动员折线 + 常模带 + 伤病/复出事件标记 + 末点值标签
 */

import { useMemo } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { injuriesByAthlete, normFor } from '@/data';
import type { Athlete } from '@/data';
import { DarkTooltip, TooltipRow } from '@/components/roster/chartTheme';
import { AXIS_TICK, GRID_STROKE, NORM_FILL } from '@/components/roster/chartConsts';
import { percentileOf } from '@/components/roster/utils';
import { ATHLETE_LINE_COLORS, trendSeries, windowSlice } from './trendUtils';
import type { TimeWindow, TrendMetric } from './trendUtils';

interface MainChartProps {
  athletes: Athlete[];
  metric: TrendMetric;
  window: TimeWindow;
  showNorm: boolean;
  showEvents: boolean;
}

interface ChartRow {
  t: number;
  date: string;
  [athleteId: string]: number | string | null;
}

export default function MainChart({ athletes, metric, window, showNorm, showEvents }: MainChartProps) {
  const primary = athletes[0];

  const rows = useMemo(() => {
    const map = new Map<string, ReturnType<typeof trendSeries>>();
    for (const a of athletes) map.set(a.id, trendSeries(a, metric));
    const baseDates = windowSlice(map.get(primary.id) ?? [], window).map((p) => p.date);
    return baseDates.map((d): ChartRow => {
      const row: ChartRow = { t: new Date(d).getTime(), date: d };
      for (const a of athletes) {
        row[a.id] = map.get(a.id)?.find((p) => p.date === d)?.value ?? null;
      }
      return row;
    });
  }, [athletes, metric, window, primary.id]);

  const norm = metric.hasNorm ? normFor(metric.key, primary.group) : undefined;
  const normLo = norm ? Math.min(...norm) : 0;
  const normHi = norm ? Math.max(...norm) : 0;

  // Y 轴范围：全部系列 + 常模带一并纳入
  const yDomain = useMemo((): [number, number] => {
    const vals = rows.flatMap((r) => athletes.map((a) => r[a.id])).filter((v): v is number => typeof v === 'number');
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (showNorm && norm) {
      lo = Math.min(lo, normLo);
      hi = Math.max(hi, normHi);
    }
    const pad = Math.max((hi - lo) * 0.15, Math.pow(10, -metric.digits));
    return [lo - pad, hi + pad];
  }, [rows, athletes, showNorm, norm, normLo, normHi, metric.digits]);

  // 事件标记：所选运动员的伤发（红）与复出（绿）
  const events = useMemo(() => {
    if (!showEvents || rows.length === 0) return [];
    const minT = rows[0].t;
    const maxT = rows[rows.length - 1].t;
    const out: { t: number; kind: 'injury' | 'return'; label: string; name: string }[] = [];
    for (const a of athletes) {
      for (const inj of injuriesByAthlete(a.id)) {
        const tInj = new Date(inj.date).getTime();
        if (tInj >= minT && tInj <= maxT) {
          out.push({ t: tInj, kind: 'injury', label: `${inj.date.slice(5)} ${inj.type.slice(0, 6)}`, name: a.name });
        }
        const tRet = new Date(inj.estReturn).getTime();
        if (inj.status === 'recovered' && tRet >= minT && tRet <= maxT) {
          out.push({ t: tRet, kind: 'return', label: `${inj.estReturn.slice(5)} 复出`, name: a.name });
        }
      }
    }
    return out;
  }, [athletes, showEvents, rows]);

  const lastRow = rows[rows.length - 1];
  const lastValue = lastRow?.[primary.id];

  return (
    <div className="h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 24, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
          <XAxis
            type="number"
            dataKey="t"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => new Date(t).toISOString().slice(5, 10)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            scale="time"
          />
          <YAxis
            tick={{ ...AXIS_TICK, fontFamily: 'IBM Plex Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={yDomain}
            tickFormatter={(v: number) => v.toFixed(metric.digits)}
          />
          {showNorm && norm && (
            <ReferenceArea y1={normLo} y2={normHi} fill={NORM_FILL} stroke="#2563EB" strokeOpacity={0.35} strokeDasharray="4 4" />
          )}
          <Tooltip
            cursor={{ stroke: 'rgba(6,182,212,0.5)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as ChartRow;
              const primaryVal = row[primary.id];
              return (
                <DarkTooltip title={row.date}>
                  {athletes.map((a, i) => {
                    const v = row[a.id];
                    if (v === null || v === undefined) return null;
                    return (
                      <TooltipRow
                        key={a.id}
                        color={ATHLETE_LINE_COLORS[i]}
                        name={a.name}
                        value={`${v}${metric.unit}`}
                        dash={i > 0}
                      />
                    );
                  })}
                  {typeof primaryVal === 'number' && metric.hasNorm && (
                    <p className="pt-0.5 text-[10px] text-slate-400">
                      当次百分位 P{percentileOf(primaryVal, metric.key, primary.group)}
                      {norm ? ` · ${primary.group} 常模 ${normLo.toFixed(metric.digits)}–${normHi.toFixed(metric.digits)}` : ''}
                    </p>
                  )}
                </DarkTooltip>
              );
            }}
          />
          {athletes.map((a, i) => (
            <Line
              key={a.id}
              name={a.name}
              type="monotone"
              dataKey={a.id}
              stroke={ATHLETE_LINE_COLORS[i]}
              strokeWidth={i === 0 ? 2.5 : 2}
              strokeDasharray={i === 0 ? undefined : '6 4'}
              dot={{ r: i === 0 ? 3.5 : 2.5, strokeWidth: 0 }}
              activeDot={{ r: 5.5 }}
              connectNulls
              animationDuration={800}
            />
          ))}
          {/* 末点发光大点 + 值标签 */}
          {typeof lastValue === 'number' && lastRow && (
            <ReferenceDot
              x={lastRow.t}
              y={lastValue}
              r={6}
              fill="#3B82F6"
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: `${lastValue}${metric.unit}`,
                position: 'top',
                fill: '#2563EB',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            />
          )}
          {/* 伤病 / 复出事件标记 */}
          {events.map((e, i) => (
            <ReferenceLine
              key={`${e.kind}-${e.t}-${i}`}
              x={e.t}
              stroke={e.kind === 'injury' ? '#DC2626' : '#16A34A'}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `${e.kind === 'injury' ? '伤' : '✓'} ${e.label}`,
                position: i % 2 === 0 ? 'insideTopLeft' : 'insideBottomLeft',
                fontSize: 10,
                fill: e.kind === 'injury' ? '#DC2626' : '#16A34A',
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* 图例 */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-xs text-text-2">
        {athletes.map((a, i) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{
                background: ATHLETE_LINE_COLORS[i],
                ...(i > 0 ? { backgroundImage: `repeating-linear-gradient(90deg, ${ATHLETE_LINE_COLORS[i]} 0 4px, transparent 4px 7px)` } : {}),
              }}
            />
            {a.name} <span className="font-mono-data text-[10px] text-text-3">{a.group}</span>
          </span>
        ))}
        {showNorm && norm && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-dashed border-brand-600/50" style={{ background: NORM_FILL }} />
            {primary.group} 常模 {normLo.toFixed(metric.digits)}–{normHi.toFixed(metric.digits)}
          </span>
        )}
      </div>
    </div>
  );
}
