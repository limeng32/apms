/**
 * comboTesting.ts — 组合测试数据（测力台 + 计时门 → 高阶得分）
 * 对应 mock-data.md §8
 */

export interface ComboRecord {
  athleteId: string;
  /** 测试日期 */
  date: string;
  cmj: number;            // CMJ 高度 cm（测力台）
  rsiMod: number;         // RSImod（测力台）
  sprint10m: number;      // 10m 冲刺 s（计时门）
  sprint30m: number;      // 30m 冲刺 s（计时门）
  cod505: number;         // 505 变向 s（计时门）
  /** 爆发力-速度转化指数 0–100 */
  pvi: number;
  /** 左右侧差异 %（单腿 CMJ 左右差）；<8% 绿 / 8–15% 黄 / >15% 红 */
  asymmetry: number;
  /** 变向赤字 s = 505 − 10m */
  codDeficit: number;
}

/** 不对称状态判定 */
export function asymmetryStatus(v: number): 'green' | 'amber' | 'red' {
  if (v > 15) return 'red';
  if (v >= 8) return 'amber';
  return 'green';
}

/** 2025-06 季中组合测试（10 名参测运动员） */
export const COMBO_RECORDS: ComboRecord[] = [
  { athleteId: 'A05', date: '2025-06-12', cmj: 43.2, rsiMod: 0.46, sprint10m: 1.78, sprint30m: 4.19, cod505: 2.31, pvi: 88, asymmetry: 4.2, codDeficit: 0.53 },
  { athleteId: 'A01', date: '2025-06-12', cmj: 44.5, rsiMod: 0.48, sprint10m: 1.76, sprint30m: 4.15, cod505: 2.28, pvi: 90, asymmetry: 3.6, codDeficit: 0.52 },
  { athleteId: 'A06', date: '2025-06-12', cmj: 42.8, rsiMod: 0.45, sprint10m: 1.79, sprint30m: 4.22, cod505: 2.33, pvi: 85, asymmetry: 6.1, codDeficit: 0.54 },
  { athleteId: 'A02', date: '2025-06-12', cmj: 41.6, rsiMod: 0.44, sprint10m: 1.81, sprint30m: 4.25, cod505: 2.35, pvi: 83, asymmetry: 5.4, codDeficit: 0.54 },
  { athleteId: 'A09', date: '2025-06-12', cmj: 38.6, rsiMod: 0.41, sprint10m: 1.74, sprint30m: 4.11, cod505: 2.38, pvi: 79, asymmetry: 12.8, codDeficit: 0.64 },
  { athleteId: 'A10', date: '2025-06-13', cmj: 39.4, rsiMod: 0.42, sprint10m: 1.83, sprint30m: 4.28, cod505: 2.41, pvi: 78, asymmetry: 7.3, codDeficit: 0.58 },
  { athleteId: 'A14', date: '2025-06-13', cmj: 37.2, rsiMod: 0.40, sprint10m: 1.80, sprint30m: 4.24, cod505: 2.40, pvi: 76, asymmetry: 8.6, codDeficit: 0.60 },
  { athleteId: 'A15', date: '2025-06-13', cmj: 36.8, rsiMod: 0.39, sprint10m: 1.85, sprint30m: 4.31, cod505: 2.44, pvi: 74, asymmetry: 6.8, codDeficit: 0.59 },
  { athleteId: 'A12', date: '2025-06-13', cmj: 35.5, rsiMod: 0.38, sprint10m: 1.88, sprint30m: 4.36, cod505: 2.47, pvi: 72, asymmetry: 5.9, codDeficit: 0.59 },
  { athleteId: 'A03', date: '2025-06-13', cmj: 36.1, rsiMod: 0.38, sprint10m: 1.86, sprint30m: 4.32, cod505: 2.57, pvi: 71, asymmetry: 16.5, codDeficit: 0.71 },
];

export function comboRecord(athleteId: string): ComboRecord | undefined {
  return COMBO_RECORDS.find((r) => r.athleteId === athleteId);
}

/** 组合测试排程（调度看板用） */
export interface ComboSession {
  id: string;
  date: string;
  time: string;
  group: string;
  athleteIds: string[];
  devices: ('测力台' | '计时门')[];
  status: '已完成' | '已排期' | '待确认';
}

export const COMBO_SESSIONS: ComboSession[] = [
  { id: 'CS01', date: '2025-06-12', time: '09:00–11:30', group: 'U17–U18 前场组', athleteIds: ['A05', 'A01', 'A06', 'A02'], devices: ['测力台', '计时门'], status: '已完成' },
  { id: 'CS02', date: '2025-06-13', time: '09:00–11:30', group: 'U15–U16 混合组', athleteIds: ['A09', 'A10', 'A14', 'A15', 'A12', 'A03'], devices: ['测力台', '计时门'], status: '已完成' },
  { id: 'CS03', date: '2025-06-19', time: '14:00–16:00', group: 'U13–U14 敏捷组', athleteIds: ['A13', 'A16', 'A18', 'A19', 'A21', 'A22'], devices: ['计时门'], status: '已排期' },
  { id: 'CS04', date: '2025-06-20', time: '09:00–10:30', group: '守门员专项组', athleteIds: ['A04', 'A12', 'A20', 'A23'], devices: ['测力台', '计时门'], status: '待确认' },
];
