/**
 * Rbac — 角色权限管理 `/rbac`（rbac.md）
 * 角色卡带 + RBAC 权限矩阵（十字高亮/编辑演示）+ 越权访问演示 + 审计日志
 */

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import RoleCards from '@/components/rbac/RoleCards';
import PermissionMatrix from '@/components/rbac/PermissionMatrix';
import OverrideDemo from '@/components/rbac/OverrideDemo';
import AuditLog from '@/components/rbac/AuditLog';

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: 'easeOut' as const } },
};

export default function Rbac() {
  const { roleInfo } = useRole();
  const { toast } = useToast();

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="flex flex-col gap-5"
    >
      {/* 页头 */}
      <motion.div variants={sectionVariants} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>角色权限管理</h1>
          <p className="mt-1 text-sm text-text-2">基于角色的访问控制（RBAC）· 4 个演示角色 · 10 个功能模块</p>
        </div>
        <button
          onClick={() => toast('演示环境固定 4 个角色', 'info')}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-text-2 shadow-card transition-all hover:border-brand-500 hover:text-brand-600 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          新建角色
        </button>
      </motion.div>

      {/* 当前视角提示 */}
      <motion.p variants={sectionVariants} className="-mt-2 text-xs text-text-3">
        当前以 <span className="font-semibold" style={{ color: roleInfo.color }}>{roleInfo.name}</span>
        （{roleInfo.person} · {roleInfo.title}）视角查看
        {roleInfo.key === 'coach' ? ' · 可点击矩阵单元格演示权限调整' : ' · 矩阵为只读视图'}
      </motion.p>

      {/* 角色卡带 */}
      <motion.div variants={sectionVariants}>
        <RoleCards />
      </motion.div>

      {/* 权限矩阵 */}
      <motion.div variants={sectionVariants}>
        <PermissionMatrix />
      </motion.div>

      {/* 越权演示 + 审计日志 */}
      <motion.div variants={sectionVariants} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <OverrideDemo />
        <AuditLog />
      </motion.div>
    </motion.div>
  );
}
