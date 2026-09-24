/**
 * ModelLibrary — 足球专项模型库（testing.md §3）
 * 深色 ink-800 4 卡横排，mini SVG 示意图（hover draw 动画）+ 一键预填下发
 */

import { motion } from 'framer-motion';
import { Repeat, Zap, MoveDiagonal, Route, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TEST_MODELS } from '@/data';
import type { TestModel } from '@/data';

const MODEL_ICON: Record<string, LucideIcon> = {
  MD01: Repeat,
  MD02: Zap,
  MD03: MoveDiagonal,
  MD04: Route,
};

/** 各模型 mini 示意图（内联 SVG 几何线条） */
function ModelDiagram({ id }: { id: string }) {
  const stroke = '#06B6D4';
  const common = 'fill-none transition-[stroke-dashoffset] duration-700 ease-out [stroke-dasharray:240] [stroke-dashoffset:240] group-hover:[stroke-dashoffset:0]';
  if (id === 'MD01') {
    // Yo-Yo：2×20m 往返折线
    return (
      <svg viewBox="0 0 160 48" className="h-12 w-full">
        <path d="M8 40 L40 8 L72 40 L104 8 L136 40" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" className={common} />
        <circle cx="8" cy="40" r="2.5" fill={stroke} />
        <circle cx="136" cy="40" r="2.5" fill={stroke} />
      </svg>
    );
  }
  if (id === 'MD02') {
    // RSA：6 道冲刺平行线
    return (
      <svg viewBox="0 0 160 48" className="h-12 w-full">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1="10" y1={8 + i * 7} x2={150 - i * 6} y2={8 + i * 7} stroke={i === 0 ? '#3B82F6' : stroke} strokeWidth="1.5" strokeLinecap="round" className={common} />
        ))}
      </svg>
    );
  }
  if (id === 'MD03') {
    // Illinois：绕障斜线路径
    return (
      <svg viewBox="0 0 160 48" className="h-12 w-full">
        <path d="M10 40 L50 10 L70 30 L90 10 L110 30 L150 8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={common} />
        {[50, 70, 90, 110].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 === 0 ? 10 : 30} r="2" fill="#3B82F6" opacity="0.8" />
        ))}
      </svg>
    );
  }
  // MD04 带球绕杆：S 形绕杆
  return (
    <svg viewBox="0 0 160 48" className="h-12 w-full">
      <path d="M8 24 C 28 4, 44 4, 56 24 S 84 44, 104 24 S 140 4, 152 24" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" className={common} />
      {[32, 64, 96, 128].map((x) => (
        <circle key={x} cx={x} cy="24" r="2.5" fill="#F59E0B" />
      ))}
    </svg>
  );
}

interface ModelLibraryProps {
  onUse: (model: TestModel) => void;
}

export default function ModelLibrary({ onUse }: ModelLibraryProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2>足球专项模型库</h2>
          <p className="mt-0.5 text-xs text-text-3">内置标准化测试方案 · 点击「使用此模型」自动勾选指标并预填下发器</p>
        </div>
        <span className="text-xs text-text-3">{TEST_MODELS.length} 套模型</span>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {TEST_MODELS.map((model, i) => {
          const Icon = MODEL_ICON[model.id] ?? Repeat;
          return (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut', delay: i * 0.08 }}
              className="group flex flex-col rounded-[14px] border border-ink-700 bg-ink-800 p-5 transition-all duration-150 hover:-translate-y-1 hover:border-brand-500/50 hover:shadow-glowBlue"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 text-cyan-400">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-[15px] font-semibold text-white">{model.name}</h3>
              </div>
              <p className="mt-2.5 text-xs leading-5 text-slate-400">{model.desc}</p>
              <p className="mt-1 font-mono-data text-xs text-slate-500">{model.protocol}</p>
              <div className="mt-3">
                <ModelDiagram id={model.id} />
              </div>
              <p className="mt-2 rounded-md bg-ink-900/70 px-2 py-1.5 text-[11px] leading-4 text-cyan-200/80">
                {model.normHint}
              </p>
              <button
                onClick={() => onUse(model)}
                className="mt-3 flex items-center gap-1 self-start text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
              >
                使用此模型下发
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
