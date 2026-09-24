/**
 * SmallMultiples — 多指标同屏矩阵（trends.md §5）
 * 3×2 迷你折线网格：常模带 + 末值标签；点击切换主图指标
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { ChartCard } from '@/components/common';
import { normFor } from '@/data';
import type { Athlete } from '@/data';
import { cn } from '@/lib/utils';
import { AXIS_TICK, GRID_STROKE, NORM_FILL } from '@/components/roster/chartConsts';
import { BODY_TREND_METRICS, CORE_TREND_METRICS, trendSeries } from './trendUtils';
import type { TrendMetric } from './trendUtils';

interface SmallMultiplesProps {
  athlete: Athlete;
  activeKey: string;
  isDoctor: boolean;
  onSelect: (m: TrendMetric) => void;
}

function MiniChart({ athlete, metric }: { athlete: Athlete; metric: TrendMetric }) {
  const data = useMemo(() => trendSeries(athlete, metric).map((p) => ({ t: p.t, date: p.date, v: p.value })), [athlete, metric]);
  const norm = metric.hasNorm ? normFor(metric.key, athlete.group) : undefined;
  const last = data[data.length - 1];
  const yDomain = useMemo((): [number, number] => {
    const vals = data.map((p) => p.v);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (norm) {
      lo = Math.min(lo, ...norm);
      hi = Math.max(hi, ...norm);
    }
    const pad = Math.max((hi - lo) * 0.18, Math.pow(10, -metric.digits));
    return [lo - pad, hi + pad];
  }, [data, norm, metric.digits]);
  return (
    <div className="relative h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
          <YAxis tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={40} domain={yDomain} tickFormatter={(v: number) => v.toFixed(metric.digits)} />
          {norm && (
            <ReferenceArea y1={Math.min(...norm)} y2={Math.max(...norm)} fill={NORM_FILL} stroke="#2563EB" strokeOpacity={0.3} strokeDasharray="3 3" />
          )}
          <Line type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2} dot={false} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
      {last && (
        <span className="absolute right-1 top-1 rounded-md bg-brand-600 px-1.5 py-0.5 font-mono-data text-[11px] font-semibold text-white">
          {last.v}
          {metric.unit}
        </span>
      )}
    </div>
  );
}

export default function SmallMultiples({ athlete, activeKey, isDoctor, onSelect }: SmallMultiplesProps) {
  const visible = isDoctor ? BODY_TREND_METRICS : CORE_TREND_METRICS;
  const lockedCount = isDoctor ? Math.min(3, CORE_TREND_METRICS.length) : 0;

  return (
    <ChartCard title="多指标同屏矩阵" subtitle="点击任意小图切换主图指标" className="mt-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((m, i) => {
          const active = m.key === activeKey;
          return (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => onSelect(m)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift',
                active ? 'border-brand-600 shadow-glowBlue' : 'border-line',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn('text-xs font-medium', active ? 'text-brand-600' : 'text-text-2')}>{m.name}</span>
                {active && <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-medium text-white">当前</span>}
              </div>
              <MiniChart athlete={athlete} metric={m} />
            </motion.button>
          );
        })}
        {Array.from({ length: lockedCount }, (_, i) => (
          <motion.div
            key={`locked-${i}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (visible.length + i) * 0.06, duration: 0.3 }}
            className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-canvas/60 text-text-3"
          >
            <Lock className="h-5 w-5" />
            <p className="mt-2 text-xs">{CORE_TREND_METRICS[i]?.name ?? '指标'} · 无权限</p>
          </motion.div>
        ))}
      </div>
    </ChartCard>
  );
}
