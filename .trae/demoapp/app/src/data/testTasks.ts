/**
 * testTasks.ts — 测试任务看板（8 个任务）
 * 对应 mock-data.md §5，逐字段照抄
 */

export type TaskStatus = '未开始' | '进行中' | '已完成';
export type TaskPriority = '高' | '中' | '低';

export interface TestTask {
  id: string;
  title: string;
  /** 指标名列表（展示用） */
  items: string[];
  /** 关联指标库 id */
  itemIds: string[];
  /** 目标人群 */
  scope: string;
  /** 目标人数 */
  target: number;
  /** 已测人数 */
  tested: number;
  /** 主测人 */
  owner: string;
  /** 时间窗（2025 年 6 月） */
  window: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export const TEST_TASKS: TestTask[] = [
  { id: 'T01', title: '全队 30m 冲刺 + 计时门季中复测', items: ['10m 冲刺', '30m 冲刺'], itemIds: ['S01', 'S02'], scope: '全队', target: 24, tested: 24, owner: '李泽锋', window: '6.09–6.13', status: '已完成', priority: '高' },
  { id: 'T02', title: 'U17–U18 Yo-Yo IR1 间歇恢复', items: ['Yo-Yo IR1'], itemIds: ['E01'], scope: 'U17+U18', target: 8, tested: 5, owner: '李泽锋', window: '6.16–6.20', status: '进行中', priority: '高' },
  { id: 'T03', title: 'U13–U14 敏捷 + 带球绕杆', items: ['Illinois 敏捷测试', '带球绕杆(20m)'], itemIds: ['S04', 'T01'], scope: 'U13+U14', target: 8, tested: 4, owner: '李泽锋', window: '6.16–6.22', status: '进行中', priority: '中' },
  { id: 'T04', title: '测力台 CMJ 季中复测', items: ['CMJ 纵跳', 'RSImod'], itemIds: ['P01', 'P03'], scope: '跳项重点 10 人', target: 10, tested: 6, owner: '李泽锋', window: '6.10–6.21', status: '进行中', priority: '中' },
  { id: 'T05', title: 'U15–U16 RSA 多次冲刺', items: ['RSA 6×30m'], itemIds: ['S02'], scope: 'U15+U16', target: 8, tested: 3, owner: '李泽锋', window: '6.18–6.24', status: '进行中', priority: '中' },
  { id: 'T06', title: '守门员专项反应测试', items: ['守门员反应扑救', '反应时'], itemIds: ['T06', 'S07'], scope: 'GK 4 人', target: 4, tested: 1, owner: '李泽锋', window: '6.19–6.25', status: '未开始', priority: '低' },
  { id: 'T07', title: '全队身体形态月度采集', items: ['身高', '体重', '坐高', '体脂率'], itemIds: ['M01', 'M02', 'M03', 'M04'], scope: '全队', target: 24, tested: 24, owner: '王雪', window: '6.02–6.06', status: '已完成', priority: '中' },
  { id: 'T08', title: 'U18 力量筛查(单腿CMJ+Y平衡)', items: ['单腿 CMJ（左）', '单腿 CMJ（右）', 'Y-Balance'], itemIds: ['P05', 'P06'], scope: 'U18', target: 4, tested: 2, owner: '李泽锋', window: '6.16–6.27', status: '进行中', priority: '中' },
];

// ---------- 查询辅助 ----------

export function getTask(id: string): TestTask | undefined {
  return TEST_TASKS.find((t) => t.id === id);
}

export function taskProgress(t: TestTask): number {
  return Math.round((t.tested / t.target) * 100);
}

/** 本周活跃任务（状态非"已完成"且时间窗覆盖本周 6.16–6.22）：T02–T06、T08 共 6 个 */
export function activeTasks(): TestTask[] {
  return TEST_TASKS.filter((t) => t.status !== '已完成');
}

export interface TaskSummary {
  activeCount: number;      // 6
  testedTotal: number;      // 69
  targetTotal: number;      // 94
  weeklyRate: number;       // 73 (%)
}

/**
 * 本周完成率口径（mock-data.md §5 汇总口径）：
 * 已完成人次 69 / 目标人次 94 ≈ 73%（含任务外的补测人次目标，故目标人次大于 8 任务表内合计 90）
 */
export const WEEKLY_TESTED = 69;
export const WEEKLY_TARGET = 94;

/** 本周完成率 = 69 / 94 ≈ 73%（驾驶舱 KPI "本周测试完成率 73%"） */
export function taskSummary(): TaskSummary {
  return {
    activeCount: activeTasks().length,
    testedTotal: WEEKLY_TESTED,
    targetTotal: WEEKLY_TARGET,
    weeklyRate: Math.round((WEEKLY_TESTED / WEEKLY_TARGET) * 100),
  };
}
