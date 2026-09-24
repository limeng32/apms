/**
 * health 页面共享辅助（页面级，非公共组件）
 */

import { ACWR_WEEKS, DEMO_TODAY } from '@/data';

/** 距今天数（estReturn - DEMO_TODAY），负数表示已过期 */
export function daysUntil(date: string): number {
  const ms = new Date(date + 'T00:00:00').getTime() - new Date(DEMO_TODAY + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

/** '2025-07-05' → '07-05' */
export function shortDate(date: string): string {
  return date.slice(5);
}

/** 找到某日期所在的 ACWR 周（周一日期），用于趋势图注释定位 */
export function weekBucketOf(date: string): string | undefined {
  let hit: string | undefined;
  for (const w of ACWR_WEEKS) {
    if (w <= date) hit = w;
    else break;
  }
  return hit;
}

/** 确定性伪随机（字符串种子 → [0,1)），用于演示估算散布 */
export function seededHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
