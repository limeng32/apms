/**
 * reports.ts — 报告中心数据
 * 对应 mock-data.md §9
 */

import type { RoleKey } from './roles';
import type { NormStatus } from './norms';

export type ReportStatus = '已生成' | '生成中' | '草稿';
export type ReportType = '个人' | '团队';

export interface ReportMetricRow {
  name: string;
  unit: string;
  value: number;
  norm: string;       // 常模区间文本
  status: NormStatus;
}

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  /** 个人报告关联运动员 */
  athleteId?: string;
  /** 团队报告关联范围 */
  scope?: string;
  date: string;
  authorRole: RoleKey;
  author: string;
  pages: number;
  status: ReportStatus;
}

export const REPORTS: Report[] = [
  { id: 'R01', title: '张瑞霖 · 2025 春季综合诊断报告', type: '个人', athleteId: 'A05', date: '2025-06-10', authorRole: 'analyst', author: '陈思远', pages: 12, status: '已生成' },
  { id: 'R02', title: 'U15–U16 梯队 6 月体能诊断周报', type: '团队', scope: 'U15+U16', date: '2025-06-15', authorRole: 'fitness', author: '李泽锋', pages: 8, status: '已生成' },
  { id: 'R03', title: '周子昂 · RTP 康复进展报告', type: '个人', athleteId: 'A07', date: '2025-06-14', authorRole: 'doctor', author: '王雪', pages: 6, status: '已生成' },
  { id: 'R04', title: '全队 5 月身体形态月度报告', type: '团队', scope: '全队', date: '2025-06-06', authorRole: 'doctor', author: '王雪', pages: 10, status: '已生成' },
  { id: 'R05', title: 'U18 赛季中期力量筛查报告', type: '团队', scope: 'U18', date: '2025-06-16', authorRole: 'fitness', author: '李泽锋', pages: 7, status: '生成中' },
  { id: 'R06', title: '邓皓轩 · 负荷风险专项分析', type: '个人', athleteId: 'A23', date: '2025-06-16', authorRole: 'analyst', author: '陈思远', pages: 5, status: '草稿' },
  { id: 'R07', title: 'PHV 敏感期球员发育季度报告', type: '团队', scope: 'U13–U15', date: '2025-06-02', authorRole: 'analyst', author: '陈思远', pages: 14, status: '已生成' },
];

export function getReport(id: string): Report | undefined {
  return REPORTS.find((r) => r.id === id);
}

export function reportsByAthlete(athleteId: string): Report[] {
  return REPORTS.filter((r) => r.athleteId === athleteId);
}

// ---------- 个人报告样例详情：张瑞霖 A05《2025 春季综合诊断报告》 ----------

/** 8 指标行（当前值 / 常模 / 状态） */
export const SAMPLE_REPORT_METRICS: ReportMetricRow[] = [
  { name: 'Yo-Yo IR1', unit: 'm', value: 1680, norm: '1500–1960', status: 'pass' },
  { name: '30m 冲刺', unit: 's', value: 4.19, norm: '4.08–4.28', status: 'pass' },
  { name: 'Illinois 敏捷', unit: 's', value: 15.35, norm: '14.9–15.9', status: 'pass' },
  { name: 'CMJ 纵跳', unit: 'cm', value: 43.2, norm: '38–46', status: 'pass' },
  { name: 'RSImod', unit: '', value: 0.46, norm: '0.38–0.50', status: 'excellent' },
  { name: '带球绕杆', unit: 's', value: 9.62, norm: '9.4–10.3', status: 'pass' },
  { name: '传球精准度', unit: '分', value: 86, norm: '77–88', status: 'excellent' },
  { name: '体脂率', unit: '%', value: 9.5, norm: '9.0–12.0', status: 'pass' },
];

/** 六维雷达（0–100 标准化）：速度/耐力/力量/敏捷/技术/恢复 */
export interface RadarDim {
  dim: string;
  athlete: number;
  normAvg: number;
}

export const SAMPLE_REPORT_RADAR: RadarDim[] = [
  { dim: '速度', athlete: 82, normAvg: 70 },
  { dim: '耐力', athlete: 78, normAvg: 68 },
  { dim: '力量', athlete: 74, normAvg: 70 },
  { dim: '敏捷', athlete: 85, normAvg: 71 },
  { dim: '技术', athlete: 88, normAvg: 72 },
  { dim: '恢复', athlete: 70, normAvg: 69 },
];

/** AI 风格结论 */
export const SAMPLE_REPORT_CONCLUSIONS: string[] = [
  '张瑞霖近 8 次 Yo-Yo IR1 从 1380m 稳步提升至 1680m（+21.7%），有氧恢复能力处于 U17 常模中上水平，进步曲线健康。',
  '敏捷与技术维度（Illinois 15.35s / 传球精准度 86 分）优于同龄常模 P75 附近，为当前最突出优势项。',
  'CMJ 43.2cm 达标但增速放缓，RSImod 0.46 提示快速伸缩能力良好；建议关注下肢离心力量的持续储备。',
];

/** 训练建议 */
export const SAMPLE_REPORT_SUGGESTIONS: string[] = [
  '保持当前周负荷节奏（ACWR 1.08，处于最佳区间），避免赛季末负荷骤增。',
  '力量板块加入单腿离心训练（北欧挺、单腿 RDL），每周 2 次，目标 CMJ 突破 45cm。',
  '技术板块可提前引入高压逼抢下的第一脚触球专项，巩固优势项向比赛场景迁移。',
];

// ---------- 团队报告样例详情：《U15–U16 梯队 6 月体能诊断周报》 ----------

/** 达标率条形（按指标，U15+U16 合计 8 人达标率 %） */
export const TEAM_REPORT_PASSRATE = [
  { metric: 'Yo-Yo IR1', rate: 88 },
  { metric: '30m 冲刺', rate: 75 },
  { metric: 'Illinois', rate: 88 },
  { metric: 'CMJ', rate: 63 },
  { metric: '带球绕杆', rate: 75 },
  { metric: '传球精准度', rate: 100 },
];

/** 弱项 Top3 */
export const TEAM_REPORT_WEAKNESSES = [
  { metric: 'CMJ 纵跳', detail: '达标率 63%，A09/A14 低于 P25，建议下肢力量补课' },
  { metric: '30m 冲刺', detail: 'U16 两人成绩停滞，结合 ACWR 偏高提示疲劳累积' },
  { metric: '带球绕杆', detail: 'U15 组内离散度大（9.6s–10.4s），控球稳定性待统一强化' },
];

/** 个体离群名单 */
export const TEAM_REPORT_OUTLIERS = [
  { athleteId: 'A09', reason: 'ACWR 1.41 偏高 + CMJ 低于 P25，建议减量并复查' },
  { athleteId: 'A14', reason: '带伤训练中，绕杆成绩两周未进步' },
  { athleteId: 'A15', reason: '各项指标稳定达标，可上调至更高强度组试训' },
];
