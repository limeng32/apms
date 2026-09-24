/**
 * roles.ts — 4 演示角色 / RBAC 矩阵 / 演示账号
 * 对应 mock-data.md §11 与 design.md §10
 */

export type RoleKey = 'coach' | 'fitness' | 'doctor' | 'analyst';

/** 模块 key（与路由一一对应） */
export type ModuleKey =
  | 'dashboard'
  | 'athletes'
  | 'development'
  | 'trends'
  | 'testing'
  | 'combo'
  | 'health'
  | 'medical'
  | 'reports'
  | 'rbac';

/** 访问级别：full 全部权限 / partial 只读或部分 / none 隐藏 */
export type AccessLevel = 'full' | 'partial' | 'none';

export interface RoleInfo {
  key: RoleKey;
  /** 角色名，如 "主教练 / 管理人员" */
  name: string;
  /** 演示人物 */
  person: string;
  /** 职位 */
  title: string;
  /** 角色色 */
  color: string;
  /** 一句话定位 */
  tagline: string;
  /** 权限摘要（登录页角色卡用） */
  scope: string;
  /** 登录页图标名（lucide） */
  icon: 'ShieldCheck' | 'Zap' | 'Stethoscope' | 'LineChart';
  account: DemoAccount;
  /** 登录后欢迎 Toast 文案 */
  welcome: string;
}

export interface DemoAccount {
  email: string;
  password: string;
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  coach: {
    key: 'coach',
    name: '主教练 / 管理人员',
    person: '韩建国',
    title: '青训总监',
    color: '#2563EB',
    tagline: '全局视角，全部模块可见',
    scope: '全部 10 个模块 · 权限管理',
    icon: 'ShieldCheck',
    account: { email: 'coach@apms.demo', password: 'demo2025' },
    welcome: '韩建国教练，欢迎回来（主教练视角 · 全模块权限）',
  },
  fitness: {
    key: 'fitness',
    name: '体能师 / 测试主测人',
    person: '李泽锋',
    title: '体能教练',
    color: '#06B6D4',
    tagline: '测试体系与负荷数据的主导者',
    scope: '测试下发 · 组合测试 · 负荷监控',
    icon: 'Zap',
    account: { email: 'fitness@apms.demo', password: 'demo2025' },
    welcome: '李泽锋教练，欢迎回来（体能师视角 · 测试与负荷主导）',
  },
  doctor: {
    key: 'doctor',
    name: '队医 / 康复师',
    person: '王雪',
    title: '队医主管',
    color: '#16A34A',
    tagline: '伤病台账与 RTP 复出的责任人',
    scope: '伤病台账 · RTP 康复 · 健康预警处置',
    icon: 'Stethoscope',
    account: { email: 'doctor@apms.demo', password: 'demo2025' },
    welcome: '王雪医生，欢迎回来（队医视角 · 医疗康复全权限）',
  },
  analyst: {
    key: 'analyst',
    name: '科研人员 / 数据分析师',
    person: '陈思远',
    title: '运动科学博士',
    color: '#8B5CF6',
    tagline: '趋势、常模与报告的挖掘者',
    scope: '趋势分析 · 常模库 · 报告中心',
    icon: 'LineChart',
    account: { email: 'analyst@apms.demo', password: 'demo2025' },
    welcome: '陈思远博士，欢迎回来（科研视角 · 分析与报告主导）',
  },
};

export const ROLE_LIST: RoleInfo[] = [ROLES.coach, ROLES.fitness, ROLES.doctor, ROLES.analyst];

/** 模块元信息（路由与导航共用） */
export interface ModuleInfo {
  key: ModuleKey;
  path: string;
  label: string;
}

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  dashboard: { key: 'dashboard', path: '/', label: '数据驾驶舱' },
  athletes: { key: 'athletes', path: '/athletes', label: '花名册与360档案' },
  development: { key: 'development', path: '/development', label: '青训发育监控' },
  trends: { key: 'trends', path: '/trends', label: '纵向趋势' },
  testing: { key: 'testing', path: '/testing', label: '指标库与任务下发' },
  combo: { key: 'combo', path: '/combo', label: '组合测试调度' },
  health: { key: 'health', path: '/health', label: '健康预警中心' },
  medical: { key: 'medical', path: '/medical', label: '医疗康复' },
  reports: { key: 'reports', path: '/reports', label: '报告中心' },
  rbac: { key: 'rbac', path: '/rbac', label: '角色权限管理' },
};

/**
 * RBAC 菜单可见性矩阵（design.md §10.2）
 * full=● 全部权限  partial=◐ 只读/部分  none=○ 隐藏
 */
export const RBAC_MATRIX: Record<ModuleKey, Record<RoleKey, AccessLevel>> = {
  dashboard:   { coach: 'full',    fitness: 'full',    doctor: 'partial', analyst: 'full' },
  athletes:    { coach: 'full',    fitness: 'partial', doctor: 'partial', analyst: 'partial' },
  development: { coach: 'full',    fitness: 'partial', doctor: 'partial', analyst: 'full' },
  trends:      { coach: 'full',    fitness: 'full',    doctor: 'partial', analyst: 'full' },
  testing:     { coach: 'partial', fitness: 'full',    doctor: 'none',    analyst: 'partial' },
  combo:       { coach: 'partial', fitness: 'full',    doctor: 'none',    analyst: 'partial' },
  health:      { coach: 'full',    fitness: 'partial', doctor: 'full',    analyst: 'partial' },
  medical:     { coach: 'partial', fitness: 'partial', doctor: 'full',    analyst: 'partial' },
  reports:     { coach: 'full',    fitness: 'partial', doctor: 'partial', analyst: 'full' },
  rbac:        { coach: 'full',    fitness: 'none',    doctor: 'none',    analyst: 'partial' },
};

export function getAccess(module: ModuleKey, role: RoleKey): AccessLevel {
  return RBAC_MATRIX[module][role];
}

/** 某角色可见（非 none）的模块列表 */
export function visibleModules(role: RoleKey): ModuleInfo[] {
  return (Object.keys(MODULES) as ModuleKey[])
    .filter((k) => RBAC_MATRIX[k][role] !== 'none')
    .map((k) => MODULES[k]);
}

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  full: '全部权限',
  partial: '只读/部分',
  none: '无权限',
};

export const ACCESS_SYMBOL: Record<AccessLevel, string> = {
  full: '●',
  partial: '◐',
  none: '○',
};
