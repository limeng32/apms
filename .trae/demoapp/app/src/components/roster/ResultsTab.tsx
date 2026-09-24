/**
 * ResultsTab — 档案 Tab3「体测成绩」（roster.md §B Tab3）
 * 左侧 6 核心指标选择器 + 近 8 次折线（常模带 + 末点标注）+ 成绩明细表 + 对比运动员
 */

import { useMemo, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChartCard } from '@/components/common';
import {
  ATHLETES, CORE_METRIC_IDS, getAthlete, getTestItem, judgeVsNorm, NORM_STATUS_COLOR,
  NORM_STATUS_LABEL, normFor, RESULT_DATES, resultSeries,
} from '@/data';
import type { Athlete, CoreMetricId } from '@/data';
import { cn } from '@/lib/utils';
import { DarkTooltip, TooltipRow } from './chartTheme';
import { AXIS_TICK, GRID_STROKE, NORM_FILL } from './chartConsts';
import { METRIC_DIGITS, percentileOf } from './utils';

export default function ResultsTab({ athlete }: { athlete: Athlete }) {
  const [metric, setMetric] = useState<CoreMetricId>('E01');
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState<string>('');

  const item = getTestItem(metric)!;
  const digits = METRIC_DIGITS[metric];
  const norm = normFor(metric, athlete.group);

  const compareAthlete = compareId ? getAthlete(compareId) : undefined;

  const data = useMemo(() => {
    const mine = resultSeries(athlete.id, metric);
    const other = compareOn && compareAthlete ? resultSeries(compareAthlete.id, metric) : [];
    return RESULT_DATES.map((d, i) => ({
      date: d.slice(5),
      fullDate: d,
      mine: mine[i]?.value ?? null,
      other: other[i]?.value ?? null,
    }));
  }, [athlete.id, metric, compareOn, compareAthlete]);

  const lastPoint = data[data.length - 1];
  const others = ATHLETES.filter((a) => a.id !== athlete.id);

  // Y 轴范围：数据 + 常模带一并纳入
  const yDomain = useMemo((): [number, number] => {
    const vals = data.flatMap((r) => [r.mine, r.other]).filter((v): v is number => typeof v === 'number');
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (norm) {
      lo = Math.min(lo, ...norm);
      hi = Math.max(hi, ...norm);
    }
    const pad = Math.max((hi - lo) * 0.15, Math.pow(10, -digits));
    return [lo - pad, hi + pad];
  }, [data, norm, digits]);

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* 指标选择器（左竖向） */}
      <div className="col-span-12 lg:col-span-3">
        <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-card">
          <p className="border-b border-line px-4 py-3 text-micro uppercase text-text-3">核心指标</p>
          {CORE_METRIC_IDS.map((id) => {
            const it = getTestItem(id)!;
            const active = id === metric;
            return (
              <button
                key={id}
                onClick={() => setMetric(id)}
                className={cn(
                  'relative flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                  active ? 'bg-brand-50 font-semibold text-brand-600' : 'text-text-2 hover:bg-canvas',
                )}
              >
                {active && <motion.span layoutId="metric-indicator" className="absolute inset-y-0 left-0 w-[3px] bg-brand-600" />}
                <span>{it.name}</span>
                <span className="font-mono-data text-[11px] text-text-3">{it.unit}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 趋势图 + 明细 */}
      <div className="col-span-12 space-y-5 lg:col-span-9">
        <ChartCard
          title={`${item.name} · 近 8 次`}
          subtitle={norm ? `${athlete.group} 常模 P25–P75：${Math.min(...norm).toFixed(digits)}–${Math.max(...norm).toFixed(digits)} ${item.unit}` : undefined}
          actions={
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
                <Users className="h-3.5 w-3.5" />
                对比运动员
                <button
                  role="switch"
                  aria-checked={compareOn}
                  onClick={() => setCompareOn((v) => !v)}
                  className={cn('relative h-5 w-9 rounded-full transition-colors', compareOn ? 'bg-brand-600' : 'bg-line')}
                >
                  <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', compareOn ? 'left-[18px]' : 'left-0.5')} />
                </button>
              </label>
              {compareOn && (
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-text-1 outline-none focus:border-brand-500"
                >
                  <option value="">选择运动员…</option>
                  {others.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.group}
                    </option>
                  ))}
                </select>
              )}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={yDomain} tickFormatter={(v: number) => v.toFixed(digits)} />
              {norm && (
                <ReferenceArea
                  y1={Math.min(...norm)}
                  y2={Math.max(...norm)}
                  fill={NORM_FILL}
                  stroke="#2563EB"
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                />
              )}
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <DarkTooltip title={String(label)}>
                  {payload.map((p) => (
                    <TooltipRow key={String(p.dataKey)} color={String(p.color)} name={String(p.name)} value={`${p.value}${item.unit}`} dash={p.dataKey === 'other'} />
                  ))}
                  {lastPoint && (
                    <p className="pt-0.5 text-[10px] text-slate-400">常模带：{athlete.group} P25–P75</p>
                  )}
                </DarkTooltip>
              ) : null} />
              <Line
                name={athlete.name}
                type="monotone"
                dataKey="mine"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              {compareOn && compareAthlete && (
                <Line
                  name={compareAthlete.name}
                  type="monotone"
                  dataKey="other"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 2.5 }}
                  connectNulls
                />
              )}
              {/* 末点值标注 */}
              <ReferenceDot
                x={lastPoint.date}
                y={lastPoint.mine ?? 0}
                r={5}
                fill="#3B82F6"
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: `${lastPoint.mine}${item.unit}`,
                  position: 'top',
                  fill: '#2563EB',
                  fontSize: 12,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 700,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 成绩明细表 */}
        <ChartCard title="成绩明细" subtitle="与常模比较（P 值 = 常模百分位估算）" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">日期</th>
                <th className="px-5 py-2.5 text-right text-micro uppercase text-text-3">成绩</th>
                <th className="px-5 py-2.5 text-right text-micro uppercase text-text-3">与常模比</th>
                <th className="px-5 py-2.5 text-right text-micro uppercase text-text-3">状态</th>
                <th className="px-5 py-2.5 text-right text-micro uppercase text-text-3">环比</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, i, arr) => {
                const prev = arr[i + 1];
                const d = prev && row.mine !== null && prev.mine !== null ? row.mine - prev.mine : null;
                const higher = item.betterDirection === 'higher';
                const good = d !== null && (higher ? d > 0 : d < 0);
                const status = row.mine !== null ? judgeVsNorm(row.mine, metric, athlete.group) : null;
                const pct = row.mine !== null ? percentileOf(row.mine, metric, athlete.group) : null;
                return (
                  <tr key={row.fullDate} className="border-b border-line last:border-0 hover:bg-[#F8FAFF]">
                    <td className="px-5 py-2.5 font-mono-data text-[13px] text-text-2">{row.fullDate}</td>
                    <td className="px-5 py-2.5 text-right text-cell-num font-semibold text-text-1 tnum">
                      {row.mine}
                      <span className="ml-0.5 text-[11px] font-normal text-text-3">{item.unit}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {pct !== null && (
                        <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 font-mono-data text-[11px] font-semibold text-brand-600">
                          P{pct}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {status && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: NORM_STATUS_COLOR[status] }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: NORM_STATUS_COLOR[status] }} />
                          {NORM_STATUS_LABEL[status]}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {d === null ? (
                        <span className="font-mono-data text-[11px] text-text-3">—</span>
                      ) : d === 0 ? (
                        <Minus className="ml-auto h-3 w-3 text-text-3" />
                      ) : (
                        <span className={cn('inline-flex items-center font-mono-data text-[11px]', good ? 'text-ok' : 'text-risk')}>
                          {good ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {d > 0 ? '+' : ''}
                          {d.toFixed(digits)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ChartCard>
      </div>
    </div>
  );
}
