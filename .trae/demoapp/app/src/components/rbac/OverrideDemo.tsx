/**
 * OverrideDemo — 越权访问演示卡（rbac.md §4.1）
 * 3 个预设组合：切换角色 → 400ms loading → 路由跳转 + Toast
 * 无权限组合由 <RoleRoute> 渲染 403 演示页；脱敏组合进入部分视图
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldQuestion } from 'lucide-react';
import { MODULES, ROLES, type ModuleKey, type RoleKey } from '@/data';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import { cn } from '@/lib/utils';

interface Preset {
  role: RoleKey;
  module: ModuleKey;
  desc: string;
  expect: '403' | '脱敏';
}

const PRESETS: Preset[] = [
  { role: 'doctor', module: 'testing', desc: '队医 → 测试任务下发', expect: '403' },
  { role: 'fitness', module: 'rbac', desc: '体能师 → 权限管理', expect: '403' },
  { role: 'analyst', module: 'medical', desc: '分析师 → 医疗台账', expect: '脱敏' },
];

export default function OverrideDemo() {
  const { setRole } = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [running, setRunning] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (p: Preset, idx: number) => {
    if (running !== null) return;
    setRunning(idx);
    const roleInfo = ROLES[p.role];
    const mod = MODULES[p.module];
    toast(`正在以 ${roleInfo.name.split(' / ')[0]} 身份访问 ${mod.path}…`, 'info');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setRole(p.role);
      navigate(mod.path);
      setRunning(null);
    }, 400);
  };

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-3.5">
        <h3>试试越权访问</h3>
        <p className="mt-0.5 text-xs text-text-3">切换角色后，系统会隐藏无权限菜单并拦截路由</p>
      </div>
      <div className="flex-1 space-y-2.5 p-5">
        {PRESETS.map((p, i) => {
          const r = ROLES[p.role];
          const busy = running === i;
          return (
            <button
              key={p.desc}
              onClick={() => run(p, i)}
              disabled={running !== null}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition-all hover:border-brand-500 hover:shadow-card active:scale-[0.99]',
                running !== null && !busy && 'opacity-50',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${r.color}14`, color: r.color }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldQuestion className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-text-1">{p.desc}</span>
                <span className="mt-0.5 block text-[11px] text-text-3">
                  {r.person} · {r.title} → {MODULES[p.module].path}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 font-mono-data text-[10px] font-semibold',
                  p.expect === '403' ? 'bg-risk-bg text-risk' : 'bg-warn-bg text-warn',
                )}
              >
                {p.expect === '403' ? '403 拦截' : '脱敏视图'}
              </span>
            </button>
          );
        })}
        <div className="rounded-xl border border-dashed border-line bg-canvas/50 px-4 py-3 text-[11px] leading-[18px] text-text-3">
          <p className="font-medium text-text-2">403 演示流程</p>
          <p className="mt-1">
            ① 自动切换角色 → ② 侧边栏实时移除无权限菜单 → ③ 直达 URL 被路由守卫拦截，渲染 403 页（含「以有权限角色体验」与「返回驾驶舱」按钮）
          </p>
        </div>
      </div>
    </div>
  );
}
