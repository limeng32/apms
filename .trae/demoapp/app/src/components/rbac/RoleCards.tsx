/**
 * RoleCards — 4 角色卡带（rbac.md §2）
 * 权限摘要统计 + "以此角色体验"（切换 RoleContext + Toast + 跳回驾驶舱）
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LineChart, ShieldCheck, Stethoscope, Zap } from 'lucide-react';
import { ACCESS_SYMBOL, RBAC_MATRIX, ROLE_LIST, type RoleInfo } from '@/data';
import type { ModuleKey } from '@/data';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import { cn } from '@/lib/utils';

const ROLE_ICON = { ShieldCheck, Zap, Stethoscope, LineChart } as const;

function accessSummary(role: RoleInfo) {
  const levels = (Object.keys(RBAC_MATRIX) as ModuleKey[]).map((m) => RBAC_MATRIX[m][role.key]);
  return {
    full: levels.filter((l) => l === 'full').length,
    partial: levels.filter((l) => l === 'partial').length,
    none: levels.filter((l) => l === 'none').length,
  };
}

export default function RoleCards() {
  const { role, setRole } = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const experience = (r: RoleInfo) => {
    if (r.key === role) return;
    setRole(r.key);
    toast(`已切换至 ${r.name} 视角`, 'info');
    navigate('/');
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {ROLE_LIST.map((r) => {
        const Icon = ROLE_ICON[r.icon];
        const sum = accessSummary(r);
        const active = r.key === role;
        return (
          <motion.div
            key={r.key}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: 'easeOut' } } }}
            className={cn(
              'relative overflow-hidden rounded-[14px] border bg-white shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lift',
              active ? 'border-brand-600 border-2' : 'border-line',
            )}
          >
            {/* 顶部 4px 角色色条 */}
            <div className="h-1" style={{ background: r.color }} />
            {active && (
              <motion.span
                layoutId="rbac-current-badge"
                className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                当前
              </motion.span>
            )}
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `${r.color}14`, color: r.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-6 text-text-1">{r.name}</p>
                  <p className="truncate font-mono-data text-[11px] text-text-3">{r.account.email}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-text-2">{r.tagline}</p>

              {/* 权限摘要 */}
              <div className="mt-3 space-y-1 rounded-lg bg-canvas/70 px-3 py-2.5 text-[11px] leading-[18px] text-text-2">
                <p><span className="text-ok">{ACCESS_SYMBOL.full}</span> 全部权限 <span className="font-mono-data font-semibold text-text-1">{sum.full}</span> 模块</p>
                <p><span className="text-warn">{ACCESS_SYMBOL.partial}</span> 只读/部分 <span className="font-mono-data font-semibold text-text-1">{sum.partial}</span> 模块</p>
                <p><span className="text-text-3">{ACCESS_SYMBOL.none}</span> 不可见 <span className="font-mono-data font-semibold text-text-1">{sum.none}</span> 模块</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <p className="text-xs text-text-3">
                  成员 <span className="font-medium text-text-1">{r.person}</span> · 1 人
                </p>
                <button
                  onClick={() => experience(r)}
                  disabled={active}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'cursor-default text-text-3'
                      : 'text-brand-600 hover:bg-brand-50 active:scale-[0.97]',
                  )}
                >
                  {active ? '体验中' : '以此角色体验'}
                  {!active && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
