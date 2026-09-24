/**
 * ComboModelFlow — 组合模型说明卡（combo-testing.md §2）
 * 深色 ink-800 通栏：测力台 → 计时门 → 高阶派生输出，三段流程图
 */

import { motion } from 'framer-motion';
import { Gauge, Timer, Cpu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FlowNode {
  icon: LucideIcon;
  title: string;
  lines: string[];
  layerTag: string;
  chip: string;
}

const NODES: FlowNode[] = [
  {
    icon: Gauge,
    title: '测力台 Force Plate',
    lines: ['CMJ 高度 · RSImod', '离心制动力 · 左右峰值力'],
    layerTag: '输入层 · 设备直采',
    chip: 'FP-2000 测力台 · 已校准',
  },
  {
    icon: Timer,
    title: '计时门 × 4 Timing Gates',
    lines: ['10m 分段 · 30m 全程', '505 变向'],
    layerTag: '输入层 · 精度 0.001s',
    chip: 'Brower 计时门 ×4 · 已连接',
  },
  {
    icon: Cpu,
    title: '高阶派生输出',
    lines: ['PVI 转化指数', '左右侧差异 % · COD 变向赤字'],
    layerTag: '输出层 · 实时计算',
    chip: '派生引擎 · 已同步',
  },
];

/** 流动箭头（dashoffset 循环流动） */
function FlowArrow() {
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-12 shrink-0 self-center" aria-hidden>
      <line
        x1="2" y1="12" x2="52" y2="12"
        stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round"
        strokeDasharray="6 6"
        className="combo-flow-dash"
      />
      <path d="M50 6 L60 12 L50 18" fill="none" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <style>{`.combo-flow-dash{animation:comboDash 3s linear infinite}@keyframes comboDash{to{stroke-dashoffset:-48}}@media (prefers-reduced-motion:reduce){.combo-flow-dash{animation:none}}`}</style>
    </svg>
  );
}

export default function ComboModelFlow() {
  return (
    <section className="relative overflow-hidden rounded-[14px] border border-ink-700 bg-ink-800 p-6 shadow-card">
      {/* 背景装饰：球场线稿 + 青蓝光晕 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'url(/pitch-lines.svg)', backgroundSize: 480 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.20), transparent 70%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-16 h-72 w-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.16), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative mb-5">
        <h2 className="text-white">测力台 × 计时门 组合模型</h2>
        <p className="mt-1 text-xs text-slate-400">两类设备原始数据同场采集，实时派生高阶运动表现得分</p>
      </div>

      <div className="relative flex flex-col items-stretch gap-4 lg:flex-row">
        {NODES.map((node, i) => {
          const Icon = node.icon;
          return (
            <div key={node.title} className="flex flex-1 flex-col items-stretch gap-4 lg:flex-row">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut', delay: i * 0.12 }}
                className="flex-1 rounded-xl border border-ink-700 bg-ink-900/70 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 text-cyan-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{node.title}</h3>
                    <p className="font-mono-data text-[10px] uppercase tracking-wider text-slate-500">{node.layerTag}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {node.lines.map((l) => (
                    <li key={l} className="text-[11px] leading-4 text-cyan-200/70">{l}</li>
                  ))}
                </ul>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800 px-2.5 py-1 text-[11px] text-slate-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-ok" />
                  </span>
                  {node.chip}
                </div>
              </motion.div>
              {i < NODES.length - 1 && (
                <div className="flex justify-center lg:items-center">
                  <div className="rotate-90 lg:rotate-0">
                    <FlowArrow />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
