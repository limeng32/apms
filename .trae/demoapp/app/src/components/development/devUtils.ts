/**
 * development 页面共享辅助（页面级）
 * 身高增长速度序列：基于 PHV 模型的确定性推导（由真实字段 height/phvAge/maturityOffset 推导，非随机编造）
 */

import { DEMO_TODAY, type Athlete } from '@/data';

/** 当前年龄（岁）= 预测 PHV 年龄 + 成熟度偏移 */
export function currentAge(a: Athlete): number {
  return a.phvAge + a.maturityOffset;
}

/** 距 PHV 窗口结束的剩余月数（窗口 = phvAge ± 1），负数表示已越过窗口 */
export function windowRemainingMonths(a: Athlete): number {
  return Math.round((a.phvAge + 1 - currentAge(a)) * 12);
}

export interface GrowthPoint {
  /** 月份标签，如 '25-06' */
  month: string;
  /** 模型推导身高 cm */
  height: number;
  /** 年化增长速度 cm/年 */
  velocity: number;
  /** 是否为未来预测月 */
  future: boolean;
}

const HIST_MONTHS = 12;
const FUTURE_MONTHS = 6;

/**
 * PHV 增长曲线模型（演示推导）：
 * 月增长速率 = 基础 0.42cm + PHV 峰 0.38cm × exp(−offset²/1.2)，峰值 ≈ 9.6cm/年
 * 从当前身高向前回溯 12 个月，并向后预测 6 个月
 */
export function growthSeries(a: Athlete): GrowthPoint[] {
  const N = HIST_MONTHS + FUTURE_MONTHS;
  const CUR = HIST_MONTHS - 1; // 当前月索引
  // 相对当前月的偏移（月）：过去为正
  const offsets: number[] = [];
  for (let i = 0; i < N; i++) offsets.push(a.maturityOffset - (CUR - i) / 12);

  const rateOf = (off: number) => 0.42 + 0.38 * Math.exp(-(off ** 2) / 1.2);

  const heights: number[] = new Array(N);
  heights[CUR] = a.height;
  for (let i = CUR; i > 0; i--) heights[i - 1] = Math.round((heights[i] - rateOf(offsets[i])) * 10) / 10;
  for (let i = CUR; i < N - 1; i++) heights[i + 1] = Math.round((heights[i] + rateOf(offsets[i + 1])) * 10) / 10;

  const base = new Date(DEMO_TODAY + 'T00:00:00');
  return offsets.map((off, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (CUR - i), 1);
    const label = `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      month: label,
      height: heights[i],
      velocity: Math.round(rateOf(off) * 12 * 10) / 10,
      future: i > CUR,
    };
  });
}

/** 预测 PHV 所在月份标签（用于图表 PHV 区间带定位） */
export function phvMonthLabel(a: Athlete): string {
  const base = new Date(DEMO_TODAY + 'T00:00:00');
  const months = Math.round(-a.maturityOffset * 12); // 负偏移 → PHV 在未来
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1);
  return `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
