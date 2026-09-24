/**
 * 登录页 /login — login.md
 * 深色运动科技视觉 + 4 角色卡一键登录 + GSAP 雷达扫描/粒子动效
 * 动效隔离：本页全部使用 GSAP/CSS 动画，不引入 Framer Motion
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  ShieldCheck, Zap, Stethoscope, LineChart, Eye, EyeOff, Check,
  Loader2, ArrowRight, X, Users, ClipboardList, HeartPulse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRole, ROLE_LIST, RBAC_MATRIX, MODULES, ACCESS_SYMBOL } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import type { RoleKey } from '@/data/roles';
import { cn } from '@/lib/utils';

gsap.registerPlugin(useGSAP);

const ROLE_ICONS: Record<string, LucideIcon> = {
  ShieldCheck, Zap, Stethoscope, LineChart,
};

/* ---------- 粒子背景（独立 memo 组件，纯 CSS keyframes） ---------- */

function Particles({ count = 30 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        delay: -Math.random() * 8,
        duration: 5 + Math.random() * 6,
        opacity: 0.25 + Math.random() * 0.45,
        cyan: Math.random() > 0.3,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="login-particle absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.cyan ? '#06B6D4' : '#3B82F6',
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- 雷达扫描（CSS 20s 无限旋转） ---------- */

function RadarScan() {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ right: '-12%', bottom: '-22%', width: '64%', aspectRatio: '1' }}
      aria-hidden
    >
      {/* 同心圆环 */}
      {[100, 76, 52, 28].map((pct) => (
        <span
          key={pct}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ width: `${pct}%`, height: `${pct}%`, borderColor: 'rgba(6,182,212,0.15)' }}
        />
      ))}
      {/* 扫描扇面 */}
      <div className="login-radar-sweep absolute inset-0 rounded-full" />
    </div>
  );
}

/* ---------- RBAC 说明 Modal（CSS 过渡实现，避免混入 Framer Motion） ---------- */

function RbacModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const moduleKeys = Object.keys(MODULES) as (keyof typeof MODULES)[];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full max-w-2xl overflow-auto rounded-[14px] bg-white p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between">
          <h2>RBAC 权限矩阵演示</h2>
          <button onClick={onClose} className="rounded-md p-1 text-text-3 transition-colors hover:bg-canvas hover:text-text-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-text-3">
          ● 全部权限　◐ 只读/部分　○ 隐藏（菜单直接移除，越权访问路由将进入 403 演示页）
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-text-3">
              <th className="py-2 pr-2 font-semibold">模块</th>
              {ROLE_LIST.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center font-semibold">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                  {r.name.split(' / ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduleKeys.map((k) => (
              <tr key={k} className="border-b border-line/60">
                <td className="py-1.5 pr-2 text-text-2">{MODULES[k].label}</td>
                {ROLE_LIST.map((r) => {
                  const lv = RBAC_MATRIX[k][r.key];
                  return (
                    <td
                      key={r.key}
                      className="px-2 py-1.5 text-center font-mono-data"
                      style={{ color: lv === 'full' ? '#16A34A' : lv === 'partial' ? '#D97706' : '#CBD5E1' }}
                    >
                      {ACCESS_SYMBOL[lv]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- 登录页 ---------- */

export default function Login() {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const { toast } = useToast();

  const [selected, setSelected] = useState<RoleKey>('coach');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rbacOpen, setRbacOpen] = useState(false);
  const [fieldFlash, setFieldFlash] = useState(false);

  const role = ROLE_LIST.find((r) => r.key === selected)!;

  const visualRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 选择角色 → 表单闪烁过渡（150ms）
  const pickRole = useCallback((key: RoleKey) => {
    setSelected((prev) => {
      if (prev !== key) {
        setFieldFlash(true);
        setTimeout(() => setFieldFlash(false), 150);
      }
      return key;
    });
  }, []);

  // 入场 GSAP 时间线（prefers-reduced-motion 时跳过）
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.login-bg', { scale: 1.08 }, { scale: 1, duration: 1.2 }, 0)
        .fromTo(
          '.login-slogan-word',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 },
          0.2,
        )
        .fromTo(
          ['.login-sub', '.login-chip'],
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
          0.6,
        )
        .fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.4)
        .fromTo(
          '.login-role-card',
          { scale: 0.96, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, stagger: 0.08, ease: 'back.out(2)' },
          0.55,
        );
    },
    { scope: visualRef },
  );

  const doLogin = useCallback(() => {
    if (loading) return;
    setLoading(true);
    // 400ms 假延迟 → 写入 RoleContext + localStorage → 跳驾驶舱
    setTimeout(() => {
      setRole(selected);
      navigate('/');
      toast(role.welcome, 'info');
    }, 400);
  }, [loading, selected, setRole, navigate, toast, role.welcome]);

  // Enter 快捷登录
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !rbacOpen) doLogin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doLogin, rbacOpen]);

  return (
    <div ref={visualRef} className="flex min-h-[100dvh] bg-white">
      {/* 局部 keyframes（粒子漂浮 / 雷达旋转） */}
      <style>{`
        .login-particle { animation: login-drift 7s ease-in-out infinite alternate; }
        @keyframes login-drift {
          from { transform: translateY(-10px); }
          to { transform: translateY(10px); }
        }
        .login-radar-sweep {
          background: conic-gradient(from 0deg, rgba(6,182,212,0.28), rgba(6,182,212,0.06) 60deg, transparent 90deg);
          animation: login-radar 20s linear infinite;
        }
        @keyframes login-radar { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .login-particle, .login-radar-sweep { animation: none !important; }
        }
      `}</style>

      {/* ===== 左侧视觉区 55% ===== */}
      <div className="relative hidden w-[55%] overflow-hidden bg-ink-950 lg:block">
        {/* 主视觉背景图 + 深色渐变叠加 */}
        <div
          className="login-bg absolute inset-0 bg-cover bg-center will-change-transform"
          style={{ backgroundImage: 'url(/login-visual.png)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/60 via-ink-950/35 to-ink-950/55" />
        {/* 球场线稿纹理（右下 8% 透明度平铺） */}
        <div
          className="absolute bottom-0 right-0 h-[420px] w-[420px] opacity-[0.5]"
          style={{
            backgroundImage: 'url(/pitch-lines.svg)',
            backgroundSize: '210px 210px',
            maskImage: 'radial-gradient(circle at bottom right, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at bottom right, black 30%, transparent 75%)',
          }}
        />
        <RadarScan />
        <Particles count={30} />

        {/* 内容 */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          {/* 顶部 Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="APMS" className="h-10 w-10" />
            <span className="text-lg font-semibold text-white">青训运动表现系统 <span className="text-slate-400">APMS</span></span>
          </div>

          {/* 品牌标语 */}
          <div>
            <h1 className="text-display text-white">
              <span className="block overflow-hidden">
                {'用数据，看见'.split('').map((ch, i) => (
                  <span key={i} className="login-slogan-word inline-block will-change-transform">{ch}</span>
                ))}
              </span>
              <span className="block overflow-hidden">
                {'每一位运动员的成长'.split('').map((ch, i) => (
                  <span key={i} className="login-slogan-word inline-block bg-gradient-to-r from-brand-500 to-cyan-400 bg-clip-text will-change-transform" style={{ WebkitTextFillColor: 'transparent' }}>{ch}</span>
                ))}
              </span>
            </h1>
            <p className="login-sub mt-4 text-[15px] text-white/70">
              覆盖 24 支梯队 · 32 项测试指标 · 全周期健康档案
            </p>
          </div>

          {/* 底部数据胶囊条 */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: Users, text: '24 名在训运动员' },
              { icon: ClipboardList, text: '8 项本周测试任务' },
              { icon: HeartPulse, text: '3 条实时健康预警' },
            ].map((c) => (
              <span
                key={c.text}
                className="login-chip flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] text-white/90 backdrop-blur"
              >
                <c.icon className="h-3.5 w-3.5 text-cyan-300" />
                {c.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 右侧登录区 45% ===== */}
      <div className="flex w-full items-center justify-center px-6 py-10 lg:w-[45%]">
        {/* 移动端顶部横幅 */}
        <div className="absolute inset-x-0 top-0 flex h-[200px] items-end bg-ink-950 bg-cover bg-center p-6 lg:hidden" style={{ backgroundImage: 'url(/login-visual.png)' }}>
          <div className="absolute inset-0 bg-ink-950/55" />
          <div className="relative flex items-center gap-2.5">
            <img src="/logo.svg" alt="APMS" className="h-8 w-8" />
            <span className="text-base font-semibold text-white">青训运动表现系统 APMS</span>
          </div>
        </div>

        <div ref={cardRef} className="w-full max-w-[480px] max-lg:mt-[200px]">
          {/* 头部 */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-text-1">欢迎回来</h1>
              <p className="mt-1 text-[13px] text-text-3">选择演示角色，一键进入系统（演示环境，无需真实密码）</p>
            </div>
            <span className="rounded-full bg-brand-600 px-2 py-1 font-mono-data text-micro text-white">DEMO v2.4</span>
          </div>

          {/* 角色选择卡 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            {ROLE_LIST.map((r) => {
              const Icon = ROLE_ICONS[r.icon];
              const active = r.key === selected;
              return (
                <button
                  key={r.key}
                  onClick={() => pickRole(r.key)}
                  className={cn(
                    'login-role-card relative overflow-hidden rounded-xl border bg-white p-3.5 text-left transition-all duration-150',
                    active
                      ? 'border-2 border-brand-600 shadow-glowBlue'
                      : 'border-line hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-lift',
                  )}
                >
                  {/* 底部 4px 角色色条 */}
                  {active && <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: r.color }} />}
                  <div className="flex items-start justify-between">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: `${r.color}1F`, color: r.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {active ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    ) : (
                      <span className="mt-1 h-2 w-2 rounded-full" style={{ background: r.color }} />
                    )}
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-text-1">{r.name}</p>
                  <p className="mt-0.5 text-xs text-text-2">{r.person} · {r.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-3">{r.scope}</p>
                </button>
              );
            })}
          </div>

          {/* 账号表单（自动填充演示） */}
          <div className={cn('mt-5 flex flex-col gap-3 transition-opacity duration-150', fieldFlash && 'opacity-40')}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-2">演示账号</span>
              <input
                readOnly
                value={role.account.email}
                onFocus={(e) => e.target.select()}
                className="h-11 w-full rounded-lg border border-line bg-canvas px-3 font-mono-data text-sm text-text-1 outline-none transition-colors focus:border-brand-600"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-2">密码</span>
              <div className="relative">
                <input
                  readOnly
                  type={showPwd ? 'text' : 'password'}
                  value={role.account.password}
                  className="h-11 w-full rounded-lg border border-line bg-canvas px-3 pr-10 font-mono-data text-sm text-text-1 outline-none transition-colors focus:border-brand-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 transition-colors hover:text-text-1"
                  aria-label="切换密码可见性"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          {/* 登录按钮 */}
          <button
            onClick={doLogin}
            disabled={loading}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-btn-brand text-[15px] font-semibold text-white transition-all duration-150 hover:bg-btn-brand-hover hover:shadow-glowBlue active:scale-[0.97] disabled:opacity-80"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在进入驾驶舱…
              </>
            ) : (
              <>
                进入系统
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* 辅助行 */}
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <button onClick={doLogin} className="flex items-center gap-1 font-medium text-brand-600 transition-colors hover:text-brand-700">
              <Zap className="h-3.5 w-3.5" />
              一键体验
            </button>
            <button onClick={() => setRbacOpen(true)} className="text-text-3 transition-colors hover:text-text-1">
              了解 RBAC 权限演示
            </button>
          </div>
        </div>
      </div>

      <RbacModal open={rbacOpen} onClose={() => setRbacOpen(false)} />
    </div>
  );
}
