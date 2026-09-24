/**
 * InsightCards — 趋势页下方 4/4/4 三卡（trends.md §4）
 * 卡A 进步幅度 / 卡B 当前百分位 / 卡C 指标速切
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartCard, useCountUp } from '@/components/common';
import { NORM_STATUS_COLOR } from '@/data';
import type { Athlete } from '@/data';
import { cn } from '@/lib/utils';
import {
  CORE_TREND_METRICS, BODY_TREND_METRICS, currentPercentile, currentStatus,
  gapToP75, rankOf, trendSeries, windowSlice,
} from './trendUtils';
import type { TimeWindow, TrendMetric } from './trendUtils';

interface Props {
  athlete: Athlete;
  metric: TrendMetric;
  window: TimeWindow;
  isDoctor: boolean;
  onMetricChange: (m: TrendMetric) => void;
}

/* ---------- 卡 A 进步幅度 ---------- */

function ProgressCard({ athlete, metric, window }: { athlete: Athlete; metric: TrendMetric; window: TimeWindow }) {
  const series = useMemo(() => windowSlice(trendSeries(athlete, metric), window), [athlete, metric, window]);
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const delta = Math.round((last - first) * 100) / 100;
  const pct = first !== 0 ? Math.round((Math.abs(delta) / Math.abs(first)) * 1000) / 10 : 0;
  const higher = metric.betterDirection === 'higher';
  const good = delta === 0 ? true : higher ? delta > 0 : delta < 0;

  const deltas = series.slice(1).map((p, i) => {
    const d = Math.round((p.value - series[i].value) * 100) / 100;
    return { i, d, good: higher ? d >= 0 : d <= 0 };
  });
  const stalled = deltas.slice(-3).some((x) => !x.good);

  const displayDelta = useCountUp(Math.abs(delta), 600, metric.digits);
  const displayPct = useCountUp(pct, 600, 1);

  return (
    <ChartCard title="进步幅度" subtitle={`选定窗口内变化 · ${metric.name}`} className="col-span-12 lg:col-span-4">
      <div className="flex items-end gap-2">
        <span className={cn('flex items-center font-mono-data text-[30px] font-bold leading-[38px] tnum', good ? 'text-ok' : 'text-risk')}>
          {delta === 0 ? <Minus className="mr-1 h-5 w-5" /> : good ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          {delta > 0 ? '+' : delta < 0 ? '−' : ''}
          {displayDelta}
          <span className="ml-0.5 text-sm font-medium text-text-3">{metric.unit}</span>
        </span>
        <span className={cn('mb-1.5 font-mono-data text-sm font-semibold', good ? 'text-ok' : 'text-risk')}>
          {good ? '+' : '−'}
          {displayPct}%
        </span>
      </div>
      <div className="mt-3 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={deltas} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Bar dataKey="d" radius={[3, 3, 0, 0]}>
              {deltas.map((d) => (
                <Cell key={d.i} fill={d.good ? '#16A34A' : '#DC2626'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-text-3">
        {delta === 0 ? '窗口内成绩持平' : stalled ? '近段出现停滞或波动，建议结合负荷复核' : '窗口内持续进步，无平台期'}
      </p>
    </ChartCard>
  );
}

/* ---------- 卡 B 当前百分位 ---------- */

function PercentileCard({ athlete, metric }: { athlete: Athlete; metric: TrendMetric }) {
  const pct = currentPercentile(athlete, metric);
  const teamRank = rankOf(athlete, metric, 'team');
  const groupRank = rankOf(athlete, metric, 'group');
  const gap = gapToP75(athlete, metric);

  return (
    <ChartCard title="当前百分位" subtitle={metric.hasNorm ? `相对 ${athlete.group} 常模` : '该指标无常模'} className="col-span-12 lg:col-span-4">
      {pct === null ? (
        <p className="py-8 text-center text-sm text-text-3">身体形态指标不参与常模百分位判定</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-[30px] font-bold leading-[38px] text-brand-600 tnum">P{pct}</span>
            <span className="text-xs text-text-3">同龄常模百分位</span>
          </div>
          {/* 大号刻度条 */}
          <div className="relative mt-4 h-3.5 w-full rounded-full bg-[#EEF2F7]">
            {/* 常模段 P25–P75 */}
            <div className="absolute inset-y-0 rounded-full bg-[#CBD5E1]" style={{ left: '25%', width: '50%' }} />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 rounded-full bg-brand-500/70"
            />
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 22 }}
              className="absolute -top-2 text-brand-700"
              style={{ left: `calc(${pct}% - 6px)` }}
            >
              ▲
            </motion.span>
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-text-3">
            <span>P0</span>
            <span>P25</span>
            <span>P75</span>
            <span>P100</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: '队内排名', value: teamRank ? `${teamRank.rank}/${teamRank.total}` : '—' },
              { label: '年龄组排名', value: groupRank ? `${groupRank.rank}/${groupRank.total}` : '—' },
              { label: '距 P75', value: gap !== null ? `还差 ${gap}${metric.unit}` : '已超过' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-canvas px-2 py-2.5">
                <p className="font-mono-data text-sm font-bold text-text-1 tnum">{m.value}</p>
                <p className="mt-0.5 text-[10px] text-text-3">{m.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}

/* ---------- 卡 C 指标速切 ---------- */

function Sparkline({ athlete, metric }: { athlete: Athlete; metric: TrendMetric }) {
  const data = useMemo(() => trendSeries(athlete, metric).map((p) => ({ v: p.value })), [athlete, metric]);
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricSwitchCard({ athlete, metric, isDoctor, onMetricChange }: { athlete: Athlete; metric: TrendMetric; isDoctor: boolean; onMetricChange: (m: TrendMetric) => void }) {
  const visible = isDoctor ? BODY_TREND_METRICS : CORE_TREND_METRICS;
  const locked = isDoctor ? CORE_TREND_METRICS : [];
  return (
    <ChartCard title="指标速切" subtitle="点击切换主图指标" className="col-span-12 lg:col-span-4">
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((m) => {
          const series = trendSeries(athlete, m);
          const latest = series[series.length - 1]?.value;
          const status = currentStatus(athlete, m);
          const active = m.key === metric.key;
          return (
            <button
              key={m.key}
              onClick={() => onMetricChange(m)}
              className={cn(
                'rounded-xl border p-2.5 text-left transition-all active:scale-[0.97]',
                active ? 'border-brand-600 bg-brand-50 shadow-glowBlue' : 'border-line hover:border-brand-500/50 hover:bg-canvas',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-text-2">{m.name}</span>
                {status ? (
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NORM_STATUS_COLOR[status] }} />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-line" />
                )}
              </div>
              <div className="mt-1 flex items-end justify-between gap-1">
                <span className="font-mono-data text-base font-bold leading-5 text-text-1 tnum">
                  {latest}
                  <span className="ml-0.5 text-[10px] font-medium text-text-3">{m.unit}</span>
                </span>
                <Sparkline athlete={athlete} metric={m} />
              </div>
            </button>
          );
        })}
        {locked.map((m) => (
          <div key={m.key} className="flex flex-col justify-center rounded-xl border border-dashed border-line bg-canvas/60 p-2.5 text-text-3">
            <div className="flex items-center gap-1 text-xs">
              <Lock className="h-3 w-3" />
              {m.name}
            </div>
            <p className="mt-1 text-[10px]">无权限查看</p>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export default function InsightCards(p: Props) {
  return (
    <>
      <ProgressCard athlete={p.athlete} metric={p.metric} window={p.window} />
      <PercentileCard athlete={p.athlete} metric={p.metric} />
      <MetricSwitchCard athlete={p.athlete} metric={p.metric} isDoctor={p.isDoctor} onMetricChange={p.onMetricChange} />
    </>
  );
}
