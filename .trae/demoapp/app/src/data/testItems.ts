/**
 * testItems.ts — 测试指标库（5 大类 32 项）+ 4 个足球专项模型
 * 对应 mock-data.md §4
 */

export type TestCategory = '身体形态' | '速度与敏捷' | '力量与爆发' | '耐力' | '足球专项技能';
export type BetterDirection = 'higher' | 'lower';
export type TestDevice = '人工' | '测力台' | '计时门' | 'GPS';

export interface TestItem {
  id: string;
  name: string;
  unit: string;
  category: TestCategory;
  betterDirection: BetterDirection;
  hasNorm: boolean;
  device: TestDevice;
}

export const TEST_CATEGORIES: TestCategory[] = ['身体形态', '速度与敏捷', '力量与爆发', '耐力', '足球专项技能'];

export const CATEGORY_CODE: Record<TestCategory, string> = {
  身体形态: 'A',
  速度与敏捷: 'B',
  力量与爆发: 'C',
  耐力: 'D',
  足球专项技能: 'E',
};

export const TEST_ITEMS: TestItem[] = [
  // A 身体形态（6）
  { id: 'M01', name: '身高', unit: 'cm', category: '身体形态', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'M02', name: '体重', unit: 'kg', category: '身体形态', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'M03', name: '坐高', unit: 'cm', category: '身体形态', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'M04', name: '体脂率', unit: '%', category: '身体形态', betterDirection: 'lower', hasNorm: false, device: '人工' },
  { id: 'M05', name: 'BMI', unit: '', category: '身体形态', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'M06', name: '臂展', unit: 'cm', category: '身体形态', betterDirection: 'higher', hasNorm: false, device: '人工' },
  // B 速度与敏捷（7）
  { id: 'S01', name: '10m 冲刺', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: false, device: '计时门' },
  { id: 'S02', name: '30m 冲刺', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: true, device: '计时门' },
  { id: 'S03', name: '505 变向', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: false, device: '计时门' },
  { id: 'S04', name: 'Illinois 敏捷测试', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: true, device: '计时门' },
  { id: 'S05', name: 'T-Test', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: false, device: '人工' },
  { id: 'S06', name: '30m 带球冲刺', unit: 's', category: '速度与敏捷', betterDirection: 'lower', hasNorm: false, device: '计时门' },
  { id: 'S07', name: '反应时', unit: 'ms', category: '速度与敏捷', betterDirection: 'lower', hasNorm: false, device: '人工' },
  // C 力量与爆发（7）
  { id: 'P01', name: 'CMJ 纵跳', unit: 'cm', category: '力量与爆发', betterDirection: 'higher', hasNorm: true, device: '测力台' },
  { id: 'P02', name: 'SJ 蹲跳', unit: 'cm', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '测力台' },
  { id: 'P03', name: 'RSImod', unit: '', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '测力台' },
  { id: 'P04', name: '立定跳远', unit: 'cm', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'P05', name: '单腿 CMJ（左）', unit: 'cm', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '测力台' },
  { id: 'P06', name: '单腿 CMJ（右）', unit: 'cm', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '测力台' },
  { id: 'P07', name: '引体向上', unit: '次', category: '力量与爆发', betterDirection: 'higher', hasNorm: false, device: '人工' },
  // D 耐力（4）
  { id: 'E01', name: 'Yo-Yo IR1', unit: 'm', category: '耐力', betterDirection: 'higher', hasNorm: true, device: '人工' },
  { id: 'E02', name: 'Yo-Yo IR2', unit: 'm', category: '耐力', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'E03', name: '最大摄氧量估算', unit: 'ml/kg/min', category: '耐力', betterDirection: 'higher', hasNorm: false, device: 'GPS' },
  { id: 'E04', name: '3000m 跑', unit: 'min', category: '耐力', betterDirection: 'lower', hasNorm: false, device: '人工' },
  // E 足球专项技能（8）
  { id: 'T01', name: '带球绕杆(20m)', unit: 's', category: '足球专项技能', betterDirection: 'lower', hasNorm: true, device: '计时门' },
  { id: 'T02', name: '传球精准度', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: true, device: '人工' },
  { id: 'T03', name: '射门精准度', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'T04', name: '第一脚触球质量', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'T05', name: '头球精准度', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'T06', name: '守门员反应扑救', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'T07', name: '定位球传中质量', unit: '分', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
  { id: 'T08', name: '一对一对抗成功率', unit: '%', category: '足球专项技能', betterDirection: 'higher', hasNorm: false, device: '人工' },
];

/** 核心 6 指标（趋势/档案/报告共用） */
export const CORE_METRIC_IDS = ['E01', 'S02', 'S04', 'P01', 'T01', 'T02'] as const;
export type CoreMetricId = (typeof CORE_METRIC_IDS)[number];

export function getTestItem(id: string): TestItem | undefined {
  return TEST_ITEMS.find((t) => t.id === id);
}

export function itemsByCategory(cat: TestCategory): TestItem[] {
  return TEST_ITEMS.filter((t) => t.category === cat);
}

/** 足球专项模型库（4 个内置模型） */
export interface TestModel {
  id: string;
  name: string;
  desc: string;
  protocol: string;
  normHint: string;
  /** 关联指标 id */
  itemIds: string[];
}

export const TEST_MODELS: TestModel[] = [
  {
    id: 'MD01',
    name: 'Yo-Yo 间歇恢复测试 (IR1)',
    desc: '2×20m 递增强度往返跑，评估间歇恢复能力',
    protocol: '记录级别 / 总距离 m',
    normHint: '常模：U15≥1200m、U17≥1600m 为良',
    itemIds: ['E01'],
  },
  {
    id: 'MD02',
    name: 'RSA 多次冲刺能力',
    desc: '6×30m 反复冲刺，评估速度维持能力',
    protocol: '取最快成绩 / 平均成绩 / 疲劳递减率 %',
    normHint: '疲劳率 <5% 为优',
    itemIds: ['S02'],
  },
  {
    id: 'MD03',
    name: 'Illinois 敏捷测试',
    desc: '10×5m 绕障变向计时，评估变向敏捷',
    protocol: '计时 s',
    normHint: '常模按年龄组 P25–P75',
    itemIds: ['S04'],
  },
  {
    id: 'MD04',
    name: '带球绕杆',
    desc: '20m 5 杆计时，人球结合速度与控球稳定性',
    protocol: '计时 s + 控球稳定性评分',
    normHint: '按年龄组常模对照',
    itemIds: ['T01'],
  },
];
