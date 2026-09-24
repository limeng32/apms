/**
 * RoleRoute — RBAC 路由守卫
 * 未选择角色 → 跳 /login；角色无权限（none）→ 演示用 403 页（含"切换角色体验"按钮）
 */

import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ShieldX, ArrowLeftRight, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRole, ROLE_LIST } from '@/context/RoleContext';
import { MODULES, type ModuleKey } from '@/data/roles';

interface RoleRouteProps {
  module: ModuleKey;
  children: ReactNode;
}

export default function RoleRoute({ module, children }: RoleRouteProps) {
  const { isAuthenticated, canAccess } = useRole();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!canAccess(module)) {
    return <ForbiddenDemo module={module} />;
  }
  return <>{children}</>;
}

function ForbiddenDemo({ module }: { module: ModuleKey }) {
  const { roleInfo, setRole } = useRole();
  const navigate = useNavigate();
  const info = MODULES[module];

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="w-full max-w-md rounded-[14px] border border-line bg-white p-8 text-center shadow-card"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-risk-bg">
          <ShieldX className="h-7 w-7 text-risk" />
        </div>
        <p className="text-micro text-text-3">403 · ACCESS DENIED</p>
        <h1 className="mt-1">当前角色无权访问</h1>
        <p className="mt-2 text-sm text-text-2">
          <span className="font-semibold" style={{ color: roleInfo.color }}>{roleInfo.name}</span>
          （{roleInfo.person} · {roleInfo.title}）没有「{info.label}」模块的访问权限。
          这是 RBAC 权限隔离的演示效果。
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {ROLE_LIST.filter((r) => r.key !== roleInfo.key).map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-xs text-text-2 transition-colors hover:border-brand-600 hover:text-text-1"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium text-text-2 transition-colors hover:bg-canvas"
          >
            <ArrowLeftRight className="h-4 w-4" />
            返回驾驶舱
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover"
          >
            <LogIn className="h-4 w-4" />
            切换角色体验
          </button>
        </div>
      </motion.div>
    </div>
  );
}
