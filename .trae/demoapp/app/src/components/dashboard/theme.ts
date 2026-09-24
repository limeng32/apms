/**
 * dashboard/theme.ts — 驾驶舱页面级共享常量与图表辅助（design.md §3/§8）
 * 仅本页面（含大屏深色变体）使用，不改公共组件
 */

/** 状态色（红黄绿语义）与图表系列色 */
export const STATUS = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
} as const;

export type Tone = 'green' | 'amber' | 'red';

/** 大屏模式下的卡片类名（配合 ChartCard className 覆盖） */
export const BIG_CARD =
  'border-ink-700 bg-ink-800 shadow-glowBlue [&>div:first-child]:border-ink-700';

/** 图表网格线色（深色模式 #1C2A45） */
export function gridColor(big: boolean): string {
  return big ? '#1C2A45' : '#EEF2F7';
}

/** 坐标轴统一样式（design.md §8：11px #94A3B8，无轴线，tickLine false） */
export function axisProps(big: boolean) {
  return {
    tick: { fontSize: 11, fill: '#94A3B8' } as const,
    axisLine: false,
    tickLine: false,
    stroke: gridColor(big),
  };
}

/** ACWR 值 → 状态（0.8–1.3 绿 / 1.3–1.5、<0.8 黄 / >1.5 红） */
export function acwrTone(v: number): Tone {
  if (v > 1.5) return 'red';
  if (v >= 0.8 && v <= 1.3) return 'green';
  return 'amber';
}
