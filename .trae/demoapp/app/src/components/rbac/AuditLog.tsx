/**
 * AuditLog — 操作审计日志流（rbac.md §4.3）
 * 条目内容取自 rbac.md 设计稿示例（数据层无审计模块）
 */

import { motion } from 'framer-motion';
import { ArrowRight, ScrollText } from 'lucide-react';
import { ROLES, type RoleKey } from '@/data';
import { useToast } from '@/components/common';

interface AuditEntry {
  time: string;
  role: RoleKey;
  action: string;
}

/** rbac.md §4.3 示例条目 */
const AUDIT_ENTRIES: AuditEntry[] = [
  { time: '10:42', role: 'doctor', action: '推进 INJ01 RTP 至阶段 2（体能重建）' },
  { time: '09:15', role: 'fitness', action: '下发任务 T05 · U15–U16 RSA 多次冲刺' },
  { time: '昨天 17:20', role: 'analyst', action: '导出报告 RPT-2025-A05-03.pdf' },
  { time: '昨天 16:05', role: 'coach', action: '审批通过 T02 · Yo-Yo IR1 复测任务' },
  { time: '昨天 11:30', role: 'doctor', action: '新增伤病记录 INJ09 · 徐子涵股四头肌挫伤' },
  { time: '06-15 18:44', role: 'fitness', action: '调整组合测试排期 · 测力台 2 号机位' },
];

export default function AuditLog() {
  const { toast } = useToast();

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3>操作日志（演示）</h3>
          <p className="mt-0.5 text-xs text-text-3">关键角色动作审计流</p>
        </div>
        <ScrollText className="h-4 w-4 text-text-3" />
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="flex-1 divide-y divide-line px-5"
      >
        {AUDIT_ENTRIES.map((e, i) => {
          const r = ROLES[e.role];
          return (
            <motion.li
              key={i}
              variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } } }}
              className="flex items-center gap-3 py-3"
            >
              <span className="w-20 shrink-0 font-mono-data text-xs text-text-3">{e.time}</span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
              <p className="min-w-0 flex-1 truncate text-[13px] text-text-2">
                <span className="font-semibold text-text-1">{r.person}</span> {e.action}
              </p>
            </motion.li>
          );
        })}
      </motion.ul>
      <div className="border-t border-line px-5 py-3">
        <button
          onClick={() => toast('完整审计日志为演示占位（未接入真实日志服务）', 'info')}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          查看完整日志
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
