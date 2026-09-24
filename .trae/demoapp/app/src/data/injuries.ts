/**
 * injuries.ts — 伤病台账 14 条 + RTP 阶段
 * 对应 mock-data.md §2，逐字段照抄
 */

export type InjuryMechanism = '训练' | '比赛' | '非接触' | '累积负荷' | '发育相关' | '其他';
export type InjurySeverity = '轻' | '中' | '重';
export type InjuryStatus = 'active' | 'recovered';
/** active 细分：停训 / 限制参训 / 带伤训练 / 监控中（由运动员 RTP 状态推导时备用） */
export type ActiveKind = '停训' | '限制' | '带伤训练' | '监控中';

export interface Injury {
  id: string;
  athleteId: string;
  /** 诊断 */
  type: string;
  /** 部位 */
  site: string;
  mechanism: InjuryMechanism;
  severity: InjurySeverity;
  /** 伤发日期 */
  date: string;
  status: InjuryStatus;
  /** 仅 active 时有 */
  activeKind?: ActiveKind;
  /** RTP 阶段 0–4 */
  rtpStage: number;
  /** 预计复出（已康复记录为实际复出日） */
  estReturn: string;
  doctor: string;
  note?: string;
}

/** RTP 五阶段 */
export const RTP_STAGES = [
  '急性期处理',
  '功能恢复',
  '体能重建',
  '专项训练',
  '完全复出',
] as const;

export const INJURIES: Injury[] = [
  { id: 'INJ01', athleteId: 'A07', type: '股二头肌 II 级拉伤', site: '右大腿后侧', mechanism: '非接触', severity: '中', date: '2025-05-28', status: 'active', activeKind: '停训', rtpStage: 2, estReturn: '2025-07-05', doctor: '王雪', note: '冲刺时非接触拉伤，目前处于体能重建期，离心力量恢复至伤前 82%。' },
  { id: 'INJ02', athleteId: 'A17', type: '踝关节外侧韧带扭伤', site: '左踝', mechanism: '比赛', severity: '中', date: '2025-06-02', status: 'active', activeKind: '停训', rtpStage: 1, estReturn: '2025-07-12', doctor: '王雪', note: '比赛变向扭伤，肿胀已消退，开始本体感觉训练。' },
  { id: 'INJ03', athleteId: 'A03', type: '髌腱末端病(跳跃膝)', site: '右膝', mechanism: '累积负荷', severity: '中', date: '2025-04-15', status: 'active', activeKind: '限制', rtpStage: 3, estReturn: '2025-06-28', doctor: '王雪', note: '累积负荷所致，已回到专项训练，需控制跳跃量并监控 ACWR。' },
  { id: 'INJ04', athleteId: 'A09', type: '腹股沟内收肌紧张', site: '右腹股沟', mechanism: '训练', severity: '轻', date: '2025-06-09', status: 'active', activeKind: '限制', rtpStage: 3, estReturn: '2025-06-23', doctor: '王雪', note: '训练中主诉紧张，冲刺量限制在 80%。' },
  { id: 'INJ05', athleteId: 'A20', type: '肩锁关节挫伤', site: '左肩', mechanism: '比赛', severity: '轻', date: '2025-06-11', status: 'active', activeKind: '限制', rtpStage: 2, estReturn: '2025-06-25', doctor: '王雪', note: '扑救落地挫伤，暂停倒地扑救训练，上肢力量维持。' },
  { id: 'INJ06', athleteId: 'A06', type: '胫骨应力性反应', site: '左胫骨', mechanism: '累积负荷', severity: '中', date: '2025-02-20', status: 'recovered', rtpStage: 4, estReturn: '2025-04-30', doctor: '王雪', note: '已于 2025-04-30 完全复出，负荷逐步恢复。' },
  { id: 'INJ07', athleteId: 'A02', type: '踝扭伤 I 级', site: '右踝', mechanism: '比赛', severity: '轻', date: '2025-01-12', status: 'recovered', rtpStage: 4, estReturn: '2025-02-02', doctor: '王雪' },
  { id: 'INJ08', athleteId: 'A10', type: '腰椎小关节紊乱', site: '腰部', mechanism: '训练', severity: '轻', date: '2024-11-05', status: 'recovered', rtpStage: 4, estReturn: '2024-12-01', doctor: '王雪' },
  { id: 'INJ09', athleteId: 'A14', type: '股四头肌挫伤', site: '左大腿', mechanism: '比赛', severity: '轻', date: '2025-06-13', status: 'active', activeKind: '带伤训练', rtpStage: 3, estReturn: '2025-06-20', doctor: '王雪', note: '比赛碰撞挫伤，带伤训练，避免直接对抗。' },
  { id: 'INJ10', athleteId: 'A01', type: '内收肌拉伤 I 级', site: '左腹股沟', mechanism: '非接触', severity: '轻', date: '2024-09-16', status: 'recovered', rtpStage: 4, estReturn: '2024-10-10', doctor: '王雪' },
  { id: 'INJ11', athleteId: 'A13', type: 'Osgood-Schlatter(胫骨结节骨骺炎)', site: '右膝', mechanism: '发育相关', severity: '轻', date: '2025-03-10', status: 'active', activeKind: '监控中', rtpStage: 3, estReturn: '2025-09-01', doctor: '王雪', note: '发育相关骨骺炎，PHV 窗口期重点监控，疼痛评分周随访。' },
  { id: 'INJ12', athleteId: 'A22', type: '手腕舟骨挫伤', site: '右手腕', mechanism: '其他', severity: '轻', date: '2024-12-08', status: 'recovered', rtpStage: 4, estReturn: '2025-01-05', doctor: '王雪', note: '摔倒支撑所致，已康复。' },
  { id: 'INJ13', athleteId: 'A18', type: '腘绳肌紧张', site: '右大腿后侧', mechanism: '训练', severity: '轻', date: '2025-05-06', status: 'recovered', rtpStage: 4, estReturn: '2025-05-20', doctor: '王雪' },
  { id: 'INJ14', athleteId: 'A24', type: 'Sever 病(跟骨骨骺炎)', site: '右足跟', mechanism: '发育相关', severity: '轻', date: '2025-04-22', status: 'active', activeKind: '监控中', rtpStage: 3, estReturn: '2025-08-15', doctor: '王雪', note: '发育相关跟骨骨骺炎，监控中，跑跳量按周调整。' },
];

// ---------- 查询辅助 ----------

export function getInjury(id: string): Injury | undefined {
  return INJURIES.find((i) => i.id === id);
}

export function injuriesByAthlete(athleteId: string): Injury[] {
  return INJURIES.filter((i) => i.athleteId === athleteId);
}

export function activeInjuries(): Injury[] {
  return INJURIES.filter((i) => i.status === 'active');
}

export function recoveredInjuries(): Injury[] {
  return INJURIES.filter((i) => i.status === 'recovered');
}

export interface InjuryStats {
  active: number;       // 8
  recovered: number;    // 6
  stopped: number;      // 停训 2
  limited: number;      // 限制参训 3
  monitoring: number;   // 带伤训练/监控中 3
}

export function injuryStats(): InjuryStats {
  const act = activeInjuries();
  return {
    active: act.length,
    recovered: recoveredInjuries().length,
    stopped: act.filter((i) => i.activeKind === '停训').length,
    limited: act.filter((i) => i.activeKind === '限制').length,
    monitoring: act.filter((i) => i.activeKind === '带伤训练' || i.activeKind === '监控中').length,
  };
}

/** 部位归组统计（台账页人体图/分布图用）：大腿3 膝2 踝2 腹股沟2 其他5 */
export function siteDistribution(): { site: string; count: number }[] {
  const bucket = (site: string): string => {
    if (site.includes('大腿')) return '大腿';
    if (site.includes('膝')) return '膝';
    if (site.includes('踝')) return '踝';
    if (site.includes('腹股沟')) return '腹股沟';
    return '其他';
  };
  const map = new Map<string, number>();
  for (const i of INJURIES) {
    const b = bucket(i.site);
    map.set(b, (map.get(b) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([site, count]) => ({ site, count }));
}
