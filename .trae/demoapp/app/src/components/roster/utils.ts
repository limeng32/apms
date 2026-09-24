/**
 * roster/utils.ts — 花名册与 360° 档案页共用的派生数据工具
 *
 * 原则：优先使用 @/data 的真实模拟数据；数据层缺失的维度
 * （六维雷达、技能百分制、身高成长序列）由运动员真实字段
 * 确定性派生（固定种子），保证跨页面、跨刷新一致，不随机编造。
 */

import type { Athlete, AgeGroup, Position, RTPStatus } from '@/data/athletes';
import { DEMO_TODAY, getNorm, judgeVsNorm, latestResult, resultSeries, athleteAcwrSeries, SAMPLE_REPORT_RADAR } from '@/data';
import type { CoreMetricId, NormStatus } from '@/data';

/** 花名册筛选状态 */
export interface RosterFilter {
  groups: AgeGroup[];
  position: Position | 'all';
  status: RTPStatus | 'all';
  query: string;
}

export const EMPTY_FILTER: RosterFilter = { groups: [], position: 'all', status: 'all', query: '' };

/** 确定性伪随机（与 testResults.ts 同款字符串种子算法） */
export function seededRandom(seed: string): () => number {
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

/** 指标小数位（与 testResults.ts 一致） */
export const METRIC_DIGITS: Record<CoreMetricId, number> = {
  E01: 0, S02: 2, S04: 2, P01: 1, T01: 2, T02: 0,
};

/**
 * 常模百分位估算：P25→25、P75→75 线性插值并外推，钳制 2–98。
 * 低优指标（如 30m）已按方向换算（p25 为较慢端 → 25 分位）。
 */
export function percentileOf(value: number, itemId: string, group: AgeGroup): number {
  const norm = getNorm(itemId);
  if (!norm) return 50;
  const [p25, p75] = norm.byGroup[group];
  const span = p75 - p25; // 高优为正，低优为负
  if (span === 0) return 50;
  const pct = 25 + ((value - p25) / span) * 50;
  return Math.min(98, Math.max(2, Math.round(pct)));
}

/** 近两次成绩环比（显示文本 + 方向 + 是否向好；dir 反映数值涨跌，good 反映训练语义） */
export function lastDelta(
  athleteId: string,
  itemId: CoreMetricId,
): { text: string; good: boolean; dir: 'up' | 'down' | 'flat' } | null {
  const s = resultSeries(athleteId, itemId);
  if (s.length < 2) return null;
  const norm = getNorm(itemId);
  const higher = norm?.betterDirection !== 'lower';
  const d = s[s.length - 1].value - s[s.length - 2].value;
  const digits = METRIC_DIGITS[itemId];
  const good = higher ? d > 0 : d < 0;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  return { text: `${sign}${Math.abs(d).toFixed(digits)}`, good: d === 0 ? true : good, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' };
}

// ---------- 六维能力雷达（概览 Tab） ----------

export interface RadarRow {
  dim: string;
  athlete: number;
  normAvg: number;
}

/** 同龄常模均值基线（取 SAMPLE_REPORT_RADAR 的常模列，跨运动员共用） */
const NORM_AVG = SAMPLE_REPORT_RADAR.map((r) => r.normAvg);

/**
 * 六维雷达：速度/耐力/力量/敏捷/技术由真实最新成绩的常模百分位映射（35–97），
 * 恢复维度由 ACWR 分区推导。A05 与报告样例对齐（SAMPLE_REPORT_RADAR）。
 */
export function sixDimRadar(a: Athlete): RadarRow[] {
  if (a.id === 'A05') return SAMPLE_REPORT_RADAR;
  const score = (itemId: CoreMetricId): number => {
    const latest = latestResult(a.id, itemId);
    if (!latest) return 60;
    return Math.round(35 + percentileOf(latest.value, itemId, a.group) * 0.62);
  };
  // 恢复：ACWR 分区 → 分数
  let recovery = 70;
  if (a.acwr === null) recovery = 52;
  else if (a.acwr > 1.5) recovery = 48;
  else if (a.acwr > 1.3 || a.acwr < 0.8) recovery = 63;
  else recovery = 78;
  const vals = [score('S02'), score('E01'), score('P01'), score('S04'), Math.round((score('T01') + score('T02')) / 2), recovery];
  const dims = ['速度', '耐力', '力量', '敏捷', '技术', '恢复'];
  return dims.map((dim, i) => ({ dim, athlete: vals[i], normAvg: NORM_AVG[i] }));
}

// ---------- 身高成长序列（体态与成长 Tab / 队医趋势视图） ----------

export interface GrowthPoint {
  date: string;   // 测量月份 YYYY-MM
  age: number;    // 当时年龄（岁，1 位小数）
  height: number; // cm
  weight: number; // kg
  isPhv: boolean; // 是否 PHV 预测点
}

function ageAt(birth: string, date: string): number {
  return (new Date(date).getTime() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000);
}

/**
 * 近 3 年身高/体重序列（半年一点，共 7 点），末点 = 当前真实身高体重。
 * 由 PHV 模型回推：PHV 前后 ±1 岁增速 7.5cm/yr，其余 5cm/yr、>PHV+2 后 2.5cm/yr。
 */
export function growthSeries(a: Athlete): GrowthPoint[] {
  const dates = ['2022-06-15', '2022-12-15', '2023-06-15', '2023-12-15', '2024-06-15', '2024-12-15', DEMO_TODAY];
  // PHV 点：最接近预测 PHV 年龄的测量点
  let phvIdx = 0;
  let best = Infinity;
  dates.forEach((d, i) => {
    const diff = Math.abs(ageAt(a.birth, d) - a.phvAge);
    if (diff < best) { best = diff; phvIdx = i; }
  });
  // 从当前身高向前回推
  const heights = new Array<number>(dates.length);
  heights[dates.length - 1] = a.height;
  for (let i = dates.length - 1; i > 0; i--) {
    const midAge = (ageAt(a.birth, dates[i]) + ageAt(a.birth, dates[i - 1])) / 2;
    const dPhv = midAge - a.phvAge;
    let rate: number; // cm / 半年
    if (dPhv > 1.5) rate = 1.2;
    else if (Math.abs(dPhv) <= 1) rate = 3.6;
    else rate = 2.6;
    heights[i - 1] = Math.max(120, heights[i] - rate);
  }
  // 体重随身高比例回推
  const weights = heights.map((h) => Math.round(a.weight * Math.pow(h / a.height, 1.6) * 2) / 2);
  return dates.map((d, i) => ({
    date: d.slice(0, 7),
    age: Number(ageAt(a.birth, d).toFixed(1)),
    height: Math.round(heights[i] * 2) / 2,
    weight: weights[i],
    isPhv: i === phvIdx,
  }));
}

// ---------- 专项技能（专项技能诊断 Tab） ----------

export interface SkillScore {
  key: string;
  name: string;
  /** 本人百分制得分 */
  score: number;
  /** 位置常模区间（子弹图灰带） */
  normLo: number;
  normHi: number;
  status: NormStatus;
}

/** 位置常模基准（演示常模：按位置对 5 技能的期望区间） */
const POSITION_SKILL_NORM: Record<Position, Record<string, [number, number]>> = {
  GK: { pass: [66, 78], shot: [55, 68], dribble: [58, 70], touch: [64, 76], header: [62, 74] },
  DF: { pass: [72, 84], shot: [62, 74], dribble: [66, 78], touch: [72, 84], header: [72, 85] },
  MF: { pass: [78, 90], shot: [68, 80], dribble: [74, 86], touch: [76, 88], header: [64, 76] },
  FW: { pass: [70, 82], shot: [76, 90], dribble: [74, 88], touch: [72, 84], header: [70, 84] },
};

/**
 * 5 项专项技能百分制得分：传球/盘带由真实测试成绩换算，
 * 射门/停球/头球由确定性种子派生并叠加位置倾向。
 */
export function skillScores(a: Athlete): SkillScore[] {
  const norms = POSITION_SKILL_NORM[a.position];
  const rand = seededRandom(`${a.id}-skills`);
  const passLatest = latestResult(a.id, 'T02');
  const dribbleLatest = latestResult(a.id, 'T01');
  const pass = passLatest ? Math.round(35 + percentileOf(passLatest.value, 'T02', a.group) * 0.62) : 72;
  const dribble = dribbleLatest ? Math.round(35 + percentileOf(dribbleLatest.value, 'T01', a.group) * 0.62) : 72;
  // 射门/停球/头球：种子派生 60–92，位置基准加成
  const posBoost = a.position === 'FW' ? 6 : a.position === 'MF' ? 2 : 0;
  const shot = Math.round(60 + rand() * 26 + posBoost);
  const touch = Math.round(62 + rand() * 26 + (a.position === 'MF' ? 5 : 0));
  const header = Math.round(58 + rand() * 26 + (a.position === 'DF' ? 6 : a.position === 'FW' ? 3 : 0));
  const raw: { key: string; name: string; score: number }[] = [
    { key: 'pass', name: '传球', score: Math.min(97, pass) },
    { key: 'shot', name: '射门', score: Math.min(97, shot) },
    { key: 'dribble', name: '盘带', score: Math.min(97, dribble) },
    { key: 'touch', name: '停球', score: Math.min(97, touch) },
    { key: 'header', name: '头球', score: Math.min(97, header) },
  ];
  return raw.map((s) => {
    const [lo, hi] = norms[s.key];
    const status: NormStatus = s.score > hi ? 'excellent' : s.score >= lo ? 'pass' : s.score >= lo - 12 ? 'watch' : 'below';
    return { ...s, normLo: lo, normHi: hi, status };
  });
}

/** 技能状态 chip 配色（优秀蓝/达标绿/关注黄/待提升红） */
export const SKILL_STATUS_STYLE: Record<NormStatus, { label: string; color: string; bg: string }> = {
  excellent: { label: '优秀', color: '#2563EB', bg: '#EFF5FF' },
  pass: { label: '达标', color: '#16A34A', bg: '#E8F7EE' },
  watch: { label: '关注', color: '#D97706', bg: '#FEF3E0' },
  below: { label: '待提升', color: '#DC2626', bg: '#FCEBEB' },
};

// ---------- 概览 Tab 辅助 ----------

/** 本周负荷（AU）：有个人序列用个人，否则全队均值 */
export function weeklyLoad(athleteId: string): number {
  const s = athleteAcwrSeries(athleteId);
  return s[s.length - 1].acute;
}

/** 常模区间文本（图例/表格用），低优指标显示为 较快–较慢 */
export function normRangeText(itemId: string, group: AgeGroup): string {
  const norm = getNorm(itemId);
  if (!norm) return '';
  const [p25, p75] = norm.byGroup[group];
  const lo = Math.min(p25, p75);
  const hi = Math.max(p25, p75);
  const digits = METRIC_DIGITS[itemId as CoreMetricId] ?? 0;
  return `${lo.toFixed(digits)}–${hi.toFixed(digits)}`;
}

export { judgeVsNorm, latestResult, resultSeries };
