/**
 * trendUtils.ts — 纵向趋势页派生数据工具
 * 核心 6 指标序列来自 @/data TEST_RESULTS；
 * 队医受限视图的身体形态指标（身高/体重/体脂）由运动员真实字段确定性派生。
 */

import type { Athlete } from '@/data';
import {
  ATHLETES, CORE_METRIC_IDS, getTestItem, judgeVsNorm, latestResult, normFor,
  RESULT_DATES, resultSeries,
} from '@/data';
import type { CoreMetricId, NormStatus } from '@/data';
import { growthSeries, percentileOf, seededRandom } from '@/components/roster/utils';

export interface TrendMetric {
  key: string; // CoreMetricId 或身体形态指标 id（M01/M02/M04）
  name: string;
  unit: string;
  category: string;
  betterDirection: 'higher' | 'lower';
  digits: number;
  hasNorm: boolean;
  core: boolean;
}

/** 核心 6 指标（有真实历史序列） */
export const CORE_TREND_METRICS: TrendMetric[] = CORE_METRIC_IDS.map((id) => {
  const it = getTestItem(id)!;
  return {
    key: id,
    name: it.name,
    unit: it.unit,
    category: it.category,
    betterDirection: it.betterDirection,
    digits: { E01: 0, S02: 2, S04: 2, P01: 1, T01: 2, T02: 0 }[id as CoreMetricId],
    hasNorm: true,
    core: true,
  };
});

/** 队医受限视图可用：身体形态类（派生序列） */
export const BODY_TREND_METRICS: TrendMetric[] = [
  { key: 'M01', name: '身高', unit: 'cm', category: '身体形态', betterDirection: 'higher', digits: 1, hasNorm: false, core: false },
  { key: 'M02', name: '体重', unit: 'kg', category: '身体形态', betterDirection: 'higher', digits: 1, hasNorm: false, core: false },
  { key: 'M04', name: '体脂率', unit: '%', category: '身体形态', betterDirection: 'lower', digits: 1, hasNorm: false, core: false },
];

export interface TrendPoint {
  date: string;
  t: number;
  value: number;
}

/** 某运动员某指标的序列（统一映射到 RESULT_DATES 8 个时间点） */
export function trendSeries(a: Athlete, metric: TrendMetric): TrendPoint[] {
  if (metric.core) {
    return resultSeries(a.id, metric.key as CoreMetricId).map((p) => ({
      date: p.date,
      t: new Date(p.date).getTime(),
      value: p.value,
    }));
  }
  // 身体形态派生序列
  if (metric.key === 'M01' || metric.key === 'M02') {
    const gs = growthSeries(a);
    // 将 7 个成长点线性插值到 RESULT_DATES
    const src = gs.map((g) => ({ t: new Date(`${g.date}-15`).getTime(), v: metric.key === 'M01' ? g.height : g.weight }));
    return RESULT_DATES.map((d) => {
      const t = new Date(d).getTime();
      let v = src[src.length - 1].v;
      for (let i = 0; i < src.length - 1; i++) {
        if (t >= src[i].t && t <= src[i + 1].t) {
          const k = (t - src[i].t) / (src[i + 1].t - src[i].t);
          v = src[i].v + (src[i + 1].v - src[i].v) * k;
          break;
        }
        if (t < src[0].t) { v = src[0].v; break; }
      }
      return { date: d, t, value: Math.round(v * 2) / 2 };
    });
  }
  // 体脂率：从略高于当前值缓慢下降至当前（确定性种子波动）
  const rand = seededRandom(`${a.id}-bodyfat`);
  const start = a.bodyFat + 0.9 + rand() * 0.5;
  return RESULT_DATES.map((d, i) => {
    const k = i / (RESULT_DATES.length - 1);
    const v = start + (a.bodyFat - start) * k + (rand() - 0.5) * 0.2;
    return { date: d, t: new Date(d).getTime(), value: Math.round(v * 10) / 10 };
  });
}

/** 当前百分位（核心指标基于常模；无常模返回 null） */
export function currentPercentile(a: Athlete, metric: TrendMetric): number | null {
  if (!metric.hasNorm) return null;
  const latest = latestResult(a.id, metric.key as CoreMetricId);
  if (!latest) return null;
  return percentileOf(latest.value, metric.key, a.group);
}

/** 当前常模状态 */
export function currentStatus(a: Athlete, metric: TrendMetric): NormStatus | null {
  if (!metric.hasNorm) return null;
  const latest = latestResult(a.id, metric.key as CoreMetricId);
  if (!latest) return null;
  return judgeVsNorm(latest.value, metric.key, a.group);
}

/** 排名：scope = 全队 / 年龄组，方向感知（更好 = 名次靠前） */
export function rankOf(a: Athlete, metric: TrendMetric, scope: 'team' | 'group'): { rank: number; total: number } | null {
  if (!metric.core) return null;
  const peers = scope === 'team' ? ATHLETES : ATHLETES.filter((x) => x.group === a.group);
  const mine = latestResult(a.id, metric.key as CoreMetricId);
  if (!mine) return null;
  const better = peers.filter((p) => {
    const v = latestResult(p.id, metric.key as CoreMetricId)?.value;
    if (v === undefined) return false;
    return metric.betterDirection === 'higher' ? v > mine.value : v < mine.value;
  }).length;
  return { rank: better + 1, total: peers.length };
}

/** 距 P75 差距（更好方向）；已优于 P75 返回 null */
export function gapToP75(a: Athlete, metric: TrendMetric): number | null {
  if (!metric.hasNorm) return null;
  const norm = normFor(metric.key, a.group);
  const latest = latestResult(a.id, metric.key as CoreMetricId);
  if (!norm || !latest) return null;
  // 低优指标 p75 为较快（小）端
  const p75 = metric.betterDirection === 'higher' ? Math.max(...norm) : Math.min(...norm);
  const gap = metric.betterDirection === 'higher' ? p75 - latest.value : latest.value - p75;
  return gap > 0 ? Math.round(gap * 100) / 100 : null;
}

export const ATHLETE_LINE_COLORS = ['#3B82F6', '#06B6D4', '#8B5CF6'];

export type TimeWindow = 4 | 8 | 'all';

export function windowSlice<T>(arr: T[], w: TimeWindow): T[] {
  return w === 'all' ? arr : arr.slice(-w);
}
