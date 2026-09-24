/**
 * norms.ts — 分年龄组常模区间（P25–P75）
 * 对应 mock-data.md §7
 * 注意：低优指标（如 30m 冲刺）p25 为较慢端、p75 为较快端，与表格一致
 */

import type { AgeGroup } from './athletes';
import type { CoreMetricId } from './testItems';

export interface NormBand {
  /** 指标库 id */
  itemId: CoreMetricId;
  name: string;
  unit: string;
  /** 高优 / 低优 */
  betterDirection: 'higher' | 'lower';
  /** 各年龄组 [P25, P75] */
  byGroup: Record<AgeGroup, [number, number]>;
}

export const NORMS: NormBand[] = [
  {
    itemId: 'E01', name: 'Yo-Yo IR1', unit: 'm', betterDirection: 'higher',
    byGroup: { U13: [800, 1200], U14: [1000, 1400], U15: [1200, 1640], U16: [1360, 1800], U17: [1500, 1960], U18: [1600, 2120] },
  },
  {
    itemId: 'S02', name: '30m 冲刺', unit: 's', betterDirection: 'lower',
    byGroup: { U13: [4.55, 4.30], U14: [4.48, 4.24], U15: [4.40, 4.18], U16: [4.34, 4.12], U17: [4.28, 4.08], U18: [4.22, 4.02] },
  },
  {
    itemId: 'S04', name: 'Illinois 敏捷测试', unit: 's', betterDirection: 'lower',
    byGroup: { U13: [17.2, 16.2], U14: [16.9, 15.9], U15: [16.5, 15.5], U16: [16.2, 15.2], U17: [15.9, 14.9], U18: [15.6, 14.7] },
  },
  {
    itemId: 'P01', name: 'CMJ 纵跳', unit: 'cm', betterDirection: 'higher',
    byGroup: { U13: [26, 32], U14: [29, 35], U15: [32, 39], U16: [35, 42], U17: [38, 46], U18: [40, 49] },
  },
  {
    itemId: 'T01', name: '带球绕杆(20m)', unit: 's', betterDirection: 'lower',
    byGroup: { U13: [11.8, 10.8], U14: [11.4, 10.4], U15: [11.0, 10.0], U16: [10.6, 9.7], U17: [10.3, 9.4], U18: [10.0, 9.1] },
  },
  {
    itemId: 'T02', name: '传球精准度', unit: '分', betterDirection: 'higher',
    byGroup: { U13: [62, 74], U14: [66, 78], U15: [70, 82], U16: [74, 85], U17: [77, 88], U18: [80, 91] },
  },
];

export function getNorm(itemId: string): NormBand | undefined {
  return NORMS.find((n) => n.itemId === itemId);
}

export function normFor(itemId: string, group: AgeGroup): [number, number] | undefined {
  return getNorm(itemId)?.byGroup[group];
}

/** 常模判定结果 */
export type NormStatus = 'excellent' | 'pass' | 'watch' | 'below';

export const NORM_STATUS_LABEL: Record<NormStatus, string> = {
  excellent: '优秀',
  pass: '达标',
  watch: '关注',
  below: '待提升',
};

export const NORM_STATUS_COLOR: Record<NormStatus, string> = {
  excellent: '#2563EB', // 蓝
  pass: '#16A34A',      // 绿
  watch: '#D97706',     // 黄
  below: '#DC2626',     // 红
};

/**
 * 状态判定：P25–P75 内="达标(绿)"；优于 P75="优秀(蓝)"；P10–P25="关注(黄)"；低于 P10="待提升(红)"
 * P10 以 P25 外侧延伸区间宽度估算（P25 − (P75−P25) 高优 / 反向同理）
 */
export function judgeVsNorm(value: number, itemId: string, group: AgeGroup): NormStatus {
  const norm = getNorm(itemId);
  if (!norm) return 'pass';
  const [p25, p75] = norm.byGroup[group];
  if (norm.betterDirection === 'higher') {
    const p10 = p25 - (p75 - p25);
    if (value > p75) return 'excellent';
    if (value >= p25) return 'pass';
    if (value >= p10) return 'watch';
    return 'below';
  }
  // 低优：p25 为较慢（大）端，p75 为较快（小）端
  const p10 = p25 + (p25 - p75);
  if (value < p75) return 'excellent';
  if (value <= p25) return 'pass';
  if (value <= p10) return 'watch';
  return 'below';
}
