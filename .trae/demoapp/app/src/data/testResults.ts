/**
 * testResults.ts — 历史成绩序列
 * 对应 mock-data.md §6：每名运动员 × 核心 6 指标 × 近 8 次（2024-09 → 2025-06）
 * 带 2–6% 合理进步波动；红/黄运动员序列体现停滞或下降段。
 * 数据为确定性生成（固定种子），跨页面一致。
 */

import { ATHLETES, type Athlete } from './athletes';
import { getNorm } from './norms';
import type { CoreMetricId } from './testItems';

/** 8 次测试日期（约每 6 周一次） */
export const RESULT_DATES: string[] = [
  '2024-09-09', '2024-10-21', '2024-12-02', '2025-01-13',
  '2025-03-03', '2025-04-14', '2025-05-26', '2025-06-16',
];

export interface ResultPoint {
  date: string;
  value: number;
}

/** 指标小数位 */
const DIGITS: Record<CoreMetricId, number> = {
  E01: 0,   // Yo-Yo IR1 m
  S02: 2,   // 30m 冲刺 s
  S04: 2,   // Illinois s
  P01: 1,   // CMJ cm
  T01: 2,   // 带球绕杆 s
  T02: 0,   // 传球精准度 分
};

/** 确定性伪随机（字符串种子 → [0,1)） */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** 手册示例（mock-data.md §6 照抄） */
const OVERRIDES: Record<string, Partial<Record<CoreMetricId, number[]>>> = {
  A05: {
    E01: [1380, 1420, 1450, 1510, 1560, 1580, 1640, 1680],
    S02: [4.42, 4.38, 4.35, 4.31, 4.28, 4.26, 4.22, 4.19],
  },
  A07: {
    P01: [41.2, 41.8, 42.5, 43.1, 42.0, 38.4, 36.9, 37.5],
  },
};

/** 停训（红）运动员：近 3 次成绩下降 */
const DECLINE_IDS = new Set(['A07', 'A17']);
/** 限制参训（黄）运动员：近 3 次停滞/微降 */
const STAGNANT_IDS = new Set(['A03', 'A09', 'A14', 'A20', 'A23']);

function generateSeries(athlete: Athlete, itemId: CoreMetricId): number[] {
  const override = OVERRIDES[athlete.id]?.[itemId];
  if (override) return override;

  const norm = getNorm(itemId);
  const digits = DIGITS[itemId];
  const rand = seededRandom(`${athlete.id}-${itemId}`);
  const n = 8;

  // 个人水平系数：0.25–0.8（在 P25–P75 内的位置，个别超出）
  const level = 0.25 + rand() * 0.55;
  let endValue: number;
  if (norm) {
    const [p25, p75] = norm.byGroup[athlete.group];
    endValue = norm.betterDirection === 'higher'
      ? p25 + level * (p75 - p25)
      : p25 - level * (p25 - p75);
  } else {
    endValue = 1;
  }

  // 总进步幅度 2–6%（高优增大 / 低优减小）
  const improvement = 0.02 + rand() * 0.04;
  const higher = norm?.betterDirection !== 'lower';
  const startValue = higher ? endValue / (1 + improvement) : endValue * (1 + improvement);

  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let v = startValue + (endValue - startValue) * t;
    // 小幅波动（±1%）
    v *= 1 + (rand() - 0.5) * 0.02;

    // 红/黄运动员在后段体现下降或停滞
    if (i >= n - 3) {
      const k = i - (n - 3) + 1; // 1..3
      if (DECLINE_IDS.has(athlete.id)) {
        const drop = higher ? 1 - 0.03 * k : 1 + 0.03 * k;
        v = endValue * drop * (1 + (rand() - 0.5) * 0.01);
      } else if (STAGNANT_IDS.has(athlete.id)) {
        const flat = higher ? 1 - 0.008 * k : 1 + 0.008 * k;
        v = endValue * flat * (1 + (rand() - 0.5) * 0.008);
      }
    }
    values.push(Number(v.toFixed(digits)));
  }
  // 保证末次值接近 endValue（除红/黄外）
  if (!DECLINE_IDS.has(athlete.id) && !STAGNANT_IDS.has(athlete.id)) {
    values[n - 1] = Number(endValue.toFixed(digits));
  }
  return values;
}

/** 全量成绩表：athleteId → metricId → 8 点序列 */
export const TEST_RESULTS: Record<string, Record<CoreMetricId, ResultPoint[]>> = Object.fromEntries(
  ATHLETES.map((a) => [
    a.id,
    Object.fromEntries(
      (['E01', 'S02', 'S04', 'P01', 'T01', 'T02'] as CoreMetricId[]).map((m) => [
        m,
        generateSeries(a, m).map((value, i) => ({ date: RESULT_DATES[i], value })),
      ]),
    ),
  ]),
) as Record<string, Record<CoreMetricId, ResultPoint[]>>;

// ---------- 查询辅助 ----------

export function resultSeries(athleteId: string, itemId: CoreMetricId): ResultPoint[] {
  return TEST_RESULTS[athleteId]?.[itemId] ?? [];
}

/** 最近一次成绩 */
export function latestResult(athleteId: string, itemId: CoreMetricId): ResultPoint | undefined {
  const s = resultSeries(athleteId, itemId);
  return s[s.length - 1];
}

/** 近 8 次变化量（末次 − 首次；低优指标为负代表进步） */
export function resultDelta(athleteId: string, itemId: CoreMetricId): number {
  const s = resultSeries(athleteId, itemId);
  if (s.length < 2) return 0;
  return Number((s[s.length - 1].value - s[0].value).toFixed(2));
}
