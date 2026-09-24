/**
 * Sidebar — 深色侧边栏（design.md §6.1）
 * 背景 #0A1120 · 248px ↔ 72px 折叠图标轨 · RBAC 菜单过滤 · Framer Motion 激活 pill
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, TrendingUp, LineChart, ClipboardList, Layers,
  HeartPulse, Stethoscope, FileText, ShieldCheck, ChevronsLeft, ChevronsRight, ArrowLeftRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole } from '@/context/RoleContext';
import { MODULES, RBAC_MATRIX, type ModuleKey } from '@/data/roles';

interface NavItem {
  module: ModuleKey;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: '总览', items: [{ module: 'dashboard', label: '数据驾驶舱', icon: LayoutDashboard }] },
  {
    label: '运动员',
    items: [
      { module: 'athletes', label: '花名册', icon: Users },
      { module: 'development', label: '青训发育监控', icon: TrendingUp },
      { module: 'trends', label: '纵向趋势', icon: LineChart },
    ],
  },
  {
    label: '测试',
    items: [
      { module: 'testing', label: '指标库与任务下发', icon: ClipboardList },
      { module: 'combo', label: '组合测试调度', icon: Layers },
    ],
  },
  {
    label: '健康',
    items: [
      { module: 'health', label: '健康预警中心', icon: HeartPulse },
      { module: 'medical', label: '医疗康复', icon: Stethoscope },
    ],
  },
  { label: '分析', items: [{ module: 'reports', label: '报告中心', icon: FileText }] },
  { label: '系统', items: [{ module: 'rbac', label: '角色权限管理', icon: ShieldCheck }] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { role, roleInfo, canAccess } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (module: ModuleKey) => {
    const path = MODULES[module].path;
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-ink-900 transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 72 : 248 }}
    >
      {/* Logo 区 */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-700/60 px-4">
        <img src="/logo.svg" alt="APMS" className="h-9 w-9 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5 text-white">青训运动表现系统</p>
            <p className="text-micro text-slate-500">APMS</p>
          </div>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((i) => canAccess(i.module));
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              {!collapsed && (
                <p className="mb-1.5 px-2 text-micro uppercase text-slate-500">{group.label}</p>
              )}
              <div className="flex flex-col gap-0.5">
                {visible.map((item) => {
                  const active = isActive(item.module);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.module}
                      to={MODULES[item.module].path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'relative flex h-10 items-center gap-3 rounded-[10px] px-2.5 text-sm transition-colors',
                        active ? 'text-white' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                          className="bg-nav-active absolute inset-0 rounded-[10px]"
                        />
                      )}
                      {active && (
                        <motion.span
                          layoutId="nav-indicator"
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
                        />
                      )}
                      <Icon className="relative z-10 h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
                      {!collapsed && RBAC_MATRIX[item.module][role] === 'partial' && (
                        <span className="relative z-10 ml-auto text-[10px] text-slate-500">◐</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* 折叠开关 */}
      <button
        onClick={onToggle}
        className="mx-3 mb-2 flex h-9 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-300"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>

      {/* 底部角色卡 */}
      <div className="shrink-0 border-t border-ink-700/60 p-3">
        <div className={cn('flex items-center gap-2.5 rounded-[10px] bg-ink-800 p-2.5', collapsed && 'justify-center p-2')}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: roleInfo.color }}
          >
            {roleInfo.person.charAt(0)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">{roleInfo.person} · {roleInfo.title}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-brand-500"
              >
                <ArrowLeftRight className="h-3 w-3" />
                切换角色
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
