/**
 * athletes.ts — 24 名梯队运动员（U13–U18 各 4 人）
 * 对应 mock-data.md §1，逐字段照抄
 */

export type AgeGroup = 'U13' | 'U14' | 'U15' | 'U16' | 'U17' | 'U18';
export type Position = 'GK' | 'DF' | 'MF' | 'FW';
export type RTPStatus = 'green' | 'amber' | 'red';
export type DominantLeg = '左' | '右';

export interface Athlete {
  id: string;
  name: string;
  group: AgeGroup;
  position: Position;
  birth: string;
  height: number;          // cm
  weight: number;          // kg
  sittingHeight: number;   // 坐高 cm
  bodyFat: number;         // 体脂率 %
  maturityOffset: number;  // 成熟度偏移（岁，相对 PHV）
  phvAge: number;          // 预测 PHV 年龄
  predictedHeight: number; // 预测成年身高 cm
  fatherHeight: number;   // 父亲身高 cm（Khamis-Roche 输入）
  motherHeight: number;   // 母亲身高 cm（Khamis-Roche 输入）
  rtp: RTPStatus;
  /** 本周急慢性负荷比；停训为 null */
  acwr: number | null;
  dominantLeg: DominantLeg;
  joinYear: number;
}

export const ATHLETES: Athlete[] = [
  { id: 'A01', name: '陈昊天', group: 'U18', position: 'FW', birth: '2007-03-12', height: 183, weight: 74, sittingHeight: 94, bodyFat: 10.2, maturityOffset: 1.4, phvAge: 14.2, predictedHeight: 185, fatherHeight: 191, motherHeight: 178, rtp: 'green', acwr: 1.06, dominantLeg: '右', joinYear: 2019 },
  { id: 'A02', name: '刘子墨', group: 'U18', position: 'MF', birth: '2007-06-25', height: 178, weight: 69, sittingHeight: 92, bodyFat: 9.8, maturityOffset: 1.1, phvAge: 14.0, predictedHeight: 181, fatherHeight: 189, motherHeight: 174, rtp: 'green', acwr: 1.12, dominantLeg: '右', joinYear: 2019 },
  { id: 'A03', name: '王奕辰', group: 'U18', position: 'DF', birth: '2007-09-08', height: 186, weight: 78, sittingHeight: 96, bodyFat: 11.5, maturityOffset: 1.6, phvAge: 13.8, predictedHeight: 188, fatherHeight: 193, motherHeight: 181, rtp: 'amber', acwr: 1.34, dominantLeg: '右', joinYear: 2020 },
  { id: 'A04', name: '李泽宇', group: 'U18', position: 'GK', birth: '2007-11-19', height: 190, weight: 82, sittingHeight: 97, bodyFat: 12.1, maturityOffset: 1.2, phvAge: 14.1, predictedHeight: 193, fatherHeight: 200, motherHeight: 186, rtp: 'green', acwr: 0.95, dominantLeg: '右', joinYear: 2018 },
  { id: 'A05', name: '张瑞霖', group: 'U17', position: 'MF', birth: '2008-02-14', height: 176, weight: 66, sittingHeight: 90, bodyFat: 9.5, maturityOffset: 0.8, phvAge: 14.3, predictedHeight: 180, fatherHeight: 184, motherHeight: 173, rtp: 'green', acwr: 1.08, dominantLeg: '左', joinYear: 2020 },
  { id: 'A06', name: '黄俊熙', group: 'U17', position: 'FW', birth: '2008-05-30', height: 179, weight: 68, sittingHeight: 92, bodyFat: 10.4, maturityOffset: 0.5, phvAge: 14.6, predictedHeight: 183, fatherHeight: 189, motherHeight: 176, rtp: 'green', acwr: 1.18, dominantLeg: '右', joinYear: 2020 },
  { id: 'A07', name: '周子昂', group: 'U17', position: 'DF', birth: '2008-08-21', height: 182, weight: 73, sittingHeight: 94, bodyFat: 11.2, maturityOffset: 0.9, phvAge: 14.2, predictedHeight: 185, fatherHeight: 193, motherHeight: 178, rtp: 'red', acwr: null, dominantLeg: '右', joinYear: 2019 },
  { id: 'A08', name: '吴启铭', group: 'U17', position: 'MF', birth: '2008-12-03', height: 174, weight: 65, sittingHeight: 89, bodyFat: 9.9, maturityOffset: 0.3, phvAge: 14.5, predictedHeight: 178, fatherHeight: 183, motherHeight: 171, rtp: 'green', acwr: 0.92, dominantLeg: '右', joinYear: 2021 },
  { id: 'A09', name: '郑凯文', group: 'U16', position: 'FW', birth: '2009-01-17', height: 175, weight: 63, sittingHeight: 89, bodyFat: 9.2, maturityOffset: 0.2, phvAge: 14.8, predictedHeight: 181, fatherHeight: 188, motherHeight: 174, rtp: 'amber', acwr: 1.41, dominantLeg: '右', joinYear: 2021 },
  { id: 'A10', name: '孙浩然', group: 'U16', position: 'DF', birth: '2009-04-09', height: 180, weight: 70, sittingHeight: 93, bodyFat: 10.8, maturityOffset: 0.6, phvAge: 14.4, predictedHeight: 184, fatherHeight: 188, motherHeight: 177, rtp: 'green', acwr: 1.02, dominantLeg: '右', joinYear: 2021 },
  { id: 'A11', name: '朱天佑', group: 'U16', position: 'MF', birth: '2009-07-26', height: 171, weight: 60, sittingHeight: 87, bodyFat: 8.8, maturityOffset: -0.4, phvAge: 15.1, predictedHeight: 177, fatherHeight: 183, motherHeight: 170, rtp: 'green', acwr: 0.88, dominantLeg: '左', joinYear: 2022 },
  { id: 'A12', name: '马铭泽', group: 'U16', position: 'GK', birth: '2009-10-15', height: 185, weight: 74, sittingHeight: 95, bodyFat: 11.6, maturityOffset: 0.7, phvAge: 14.3, predictedHeight: 189, fatherHeight: 197, motherHeight: 182, rtp: 'green', acwr: 1.15, dominantLeg: '右', joinYear: 2020 },
  { id: 'A13', name: '林沐阳', group: 'U15', position: 'MF', birth: '2010-03-05', height: 168, weight: 55, sittingHeight: 85, bodyFat: 8.5, maturityOffset: -0.9, phvAge: 15.4, predictedHeight: 176, fatherHeight: 181, motherHeight: 169, rtp: 'green', acwr: 0.96, dominantLeg: '右', joinYear: 2022 },
  { id: 'A14', name: '徐子涵', group: 'U15', position: 'FW', birth: '2010-06-18', height: 172, weight: 58, sittingHeight: 87, bodyFat: 9.1, maturityOffset: -0.2, phvAge: 14.9, predictedHeight: 179, fatherHeight: 186, motherHeight: 172, rtp: 'amber', acwr: 1.28, dominantLeg: '右', joinYear: 2022 },
  { id: 'A15', name: '高逸凡', group: 'U15', position: 'DF', birth: '2010-09-27', height: 170, weight: 57, sittingHeight: 86, bodyFat: 9.6, maturityOffset: 0.4, phvAge: 14.5, predictedHeight: 175, fatherHeight: 179, motherHeight: 168, rtp: 'green', acwr: 1.05, dominantLeg: '右', joinYear: 2023 },
  { id: 'A16', name: '何景行', group: 'U15', position: 'MF', birth: '2010-12-11', height: 165, weight: 52, sittingHeight: 84, bodyFat: 8.2, maturityOffset: -1.1, phvAge: 15.6, predictedHeight: 174, fatherHeight: 180, motherHeight: 167, rtp: 'green', acwr: 0.85, dominantLeg: '左', joinYear: 2023 },
  { id: 'A17', name: '罗一帆', group: 'U14', position: 'DF', birth: '2011-02-23', height: 163, weight: 50, sittingHeight: 83, bodyFat: 8.9, maturityOffset: -0.6, phvAge: 15.2, predictedHeight: 175, fatherHeight: 183, motherHeight: 168, rtp: 'red', acwr: null, dominantLeg: '右', joinYear: 2023 },
  { id: 'A18', name: '宋明轩', group: 'U14', position: 'FW', birth: '2011-05-16', height: 166, weight: 52, sittingHeight: 84, bodyFat: 9.3, maturityOffset: -0.3, phvAge: 15.0, predictedHeight: 177, fatherHeight: 182, motherHeight: 170, rtp: 'green', acwr: 1.10, dominantLeg: '右', joinYear: 2023 },
  { id: 'A19', name: '唐子睿', group: 'U14', position: 'MF', birth: '2011-08-29', height: 160, weight: 47, sittingHeight: 81, bodyFat: 8.0, maturityOffset: -1.3, phvAge: 15.7, predictedHeight: 172, fatherHeight: 179, motherHeight: 165, rtp: 'green', acwr: 0.82, dominantLeg: '右', joinYear: 2024 },
  { id: 'A20', name: '韩沛霖', group: 'U14', position: 'GK', birth: '2011-11-07', height: 172, weight: 58, sittingHeight: 88, bodyFat: 10.5, maturityOffset: 0.1, phvAge: 14.8, predictedHeight: 181, fatherHeight: 185, motherHeight: 174, rtp: 'amber', acwr: 1.38, dominantLeg: '右', joinYear: 2024 },
  { id: 'A21', name: '曹沐宸', group: 'U13', position: 'MF', birth: '2012-01-30', height: 155, weight: 43, sittingHeight: 79, bodyFat: 8.4, maturityOffset: -1.6, phvAge: 15.9, predictedHeight: 173, fatherHeight: 179, motherHeight: 166, rtp: 'green', acwr: 0.90, dominantLeg: '右', joinYear: 2024 },
  { id: 'A22', name: '谢云舟', group: 'U13', position: 'FW', birth: '2012-04-14', height: 158, weight: 45, sittingHeight: 80, bodyFat: 8.8, maturityOffset: -0.8, phvAge: 15.3, predictedHeight: 175, fatherHeight: 183, motherHeight: 168, rtp: 'green', acwr: 1.02, dominantLeg: '右', joinYear: 2024 },
  { id: 'A23', name: '邓皓轩', group: 'U13', position: 'DF', birth: '2012-07-22', height: 160, weight: 48, sittingHeight: 82, bodyFat: 9.7, maturityOffset: -0.5, phvAge: 15.1, predictedHeight: 174, fatherHeight: 179, motherHeight: 167, rtp: 'amber', acwr: 1.62, dominantLeg: '左', joinYear: 2025 },
  { id: 'A24', name: '冯逸飞', group: 'U13', position: 'MF', birth: '2012-10-09', height: 152, weight: 40, sittingHeight: 77, bodyFat: 7.9, maturityOffset: -1.9, phvAge: 16.1, predictedHeight: 171, fatherHeight: 178, motherHeight: 164, rtp: 'green', acwr: 0.78, dominantLeg: '右', joinYear: 2025 },
];

export const AGE_GROUPS: AgeGroup[] = ['U13', 'U14', 'U15', 'U16', 'U17', 'U18'];

export const POSITION_LABEL: Record<Position, string> = {
  GK: '门将',
  DF: '后卫',
  MF: '中场',
  FW: '前锋',
};

export const RTP_LABEL: Record<RTPStatus, string> = {
  green: '可参训',
  amber: '限制参训',
  red: '停训',
};

/** 年龄组 Avatar 取色（design.md §7 Avatar） */
export const GROUP_COLOR: Record<AgeGroup, string> = {
  U13: '#8B5CF6',
  U14: '#06B6D4',
  U15: '#3B82F6',
  U16: '#22C55E',
  U17: '#F59E0B',
  U18: '#EF4444',
};

// ---------- 查询辅助 ----------

export function getAthlete(id: string): Athlete | undefined {
  return ATHLETES.find((a) => a.id === id);
}

export function athletesByGroup(group: AgeGroup): Athlete[] {
  return ATHLETES.filter((a) => a.group === group);
}

export function athletesByRTP(status: RTPStatus): Athlete[] {
  return ATHLETES.filter((a) => a.rtp === status);
}

export interface RTPSummary {
  green: number;
  amber: number;
  red: number;
}

/** RTP 三色分布：绿 17 / 黄 5 / 红 2 */
export function rtpSummary(): RTPSummary {
  return {
    green: athletesByRTP('green').length,
    amber: athletesByRTP('amber').length,
    red: athletesByRTP('red').length,
  };
}

/** 成熟度分组：晚熟(偏移<−1) / 正常(−1~+1) / 早熟(>+1) */
export type MaturityBand = 'late' | 'onTime' | 'early';

export function maturityBand(a: Athlete): MaturityBand {
  if (a.maturityOffset < -1) return 'late';
  if (a.maturityOffset > 1) return 'early';
  return 'onTime';
}

export const MATURITY_LABEL: Record<MaturityBand, string> = {
  late: '晚熟',
  onTime: '正常',
  early: '早熟',
};

export function maturitySummary(): Record<MaturityBand, number> {
  return {
    late: ATHLETES.filter((a) => maturityBand(a) === 'late').length,
    onTime: ATHLETES.filter((a) => maturityBand(a) === 'onTime').length,
    early: ATHLETES.filter((a) => maturityBand(a) === 'early').length,
  };
}

/** PHV 窗口（|成熟度偏移| ≤ 1 岁）运动员 */
export function inPhvWindow(): Athlete[] {
  return ATHLETES.filter((a) => Math.abs(a.maturityOffset) <= 1);
}

/** PHV 敏感期重点监控 4 人 */
export const PHV_WATCH_IDS = ['A11', 'A13', 'A16', 'A19'];

/** 带伤监控中的绿状态运动员（A13 林沐阳、A24 冯逸飞） */
export const MONITORING_IDS = ['A13', 'A24'];

/** ACWR 超阈值运动员（红 >1.5 / 黄 1.3–1.5） */
export function acwrAlerts(): Athlete[] {
  return ATHLETES.filter((a) => a.acwr !== null && a.acwr > 1.3);
}

/** ACWR 分区：<0.8 负荷不足(黄) / 0.8–1.3 最佳(绿) / 1.3–1.5 高风险(黄) / >1.5 危险(红) */
export function acwrZone(v: number): 'green' | 'amber' | 'red' {
  if (v > 1.5) return 'red';
  if (v >= 0.8 && v <= 1.3) return 'green';
  return 'amber';
}
