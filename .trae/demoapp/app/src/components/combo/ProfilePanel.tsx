/**
 * ProfilePanel — 运动员高阶画像（combo-testing.md §4.2）
 * PVI 半圆仪表盘（指针 spring 摆动入场）+ 左右侧差异哑铃图 + 原始指标网格 + 操作按钮
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarPlus, AlertTriangle } from 'lucide-react';
import { Avatar, AgeBadge, StatusBadge } from '@/components/common';
import { ATHLETES, COMBO_SESSIONS, asymmetryStatus } from '@/data';
import type { ComboRecord } from '@/data';
import { cn } from '@/lib/utils';

function pviVerdict(pvi: number): { label: string; tone: 'blue' | 'green' | 'amber' | 'red' } {
  if (pvi >= 85) return { label: '爆发力-速度转化 优秀', tone: 'blue' };
  if (pvi >= 75) return { label: '爆发力-速度转化 良好', tone: 'green' };
  if (pvi >= 65) return { label: '爆发力-速度转化 一般', tone: 'amber' };
  return { label: '爆发力-速度转化 待提升', tone: 'red' };
}

/** PVI 半圆仪表盘（0–100，指针 + 蓝→青渐变弧） */
function PviGauge({ value }: { value: number }) {
  const cx = 110;
  const cy = 108;
  const r = 84;
  // 角度：180°(0 分) → 0°(100 分)
  const angle = 180 - (Math.min(100, Math.max(0, value)) / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + (r - 16) * Math.cos(rad);
  const ny = cy - (r - 16) * Math.sin(rad);

  const arc = (from: number, to: number) => {
    const a1 = (from * Math.PI) / 180;
    const a2 = (to * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 124" className="w-full max-w-[260px]">
        <defs>
          <linearGradient id="pvi-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        {/* 轨道 */}
        <path d={arc(180, 0)} fill="none" stroke="#EEF2F7" strokeWidth="12" strokeLinecap="round" />
        {/* 值弧 */}
        <motion.path
          d={arc(180, 0)}
          fill="none"
          stroke="url(#pvi-grad)"
          strokeWidth="12"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.min(1, Math.max(0, value / 100)) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* 指针 */}
        <motion.g
          initial={{ rotate: -80 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
        </motion.g>
        <circle cx={cx} cy={cy} r="5" fill="#0F172A" />
        {/* 刻度标签 */}
        <text x={cx - r} y={cy + 14} textAnchor="middle" className="fill-text-3" fontSize="10" fontFamily="IBM Plex Mono">0</text>
        <text x={cx} y={cy - r - 6} textAnchor="middle" className="fill-text-3" fontSize="10" fontFamily="IBM Plex Mono">50</text>
        <text x={cx + r} y={cy + 14} textAnchor="middle" className="fill-text-3" fontSize="10" fontFamily="IBM Plex Mono">100</text>
      </svg>
      <span className="-mt-9 font-mono-data text-3xl font-bold text-text-1">{value}</span>
    </div>
  );
}

/** 哑铃图单侧条 */
function DumbbellBar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-text-2">{label}</span>
      <div className="flex h-5 flex-1 items-center overflow-hidden rounded-md bg-[#EEF2F7]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${val}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
          className="h-full rounded-md"
          style={{ background: val >= 99.9 ? 'linear-gradient(90deg,#2563EB,#06B6D4)' : color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono-data text-cell-num text-text-1">{val}%</span>
    </div>
  );
}

/** 左右侧差异哑铃图（相对峰值力指数：强侧=100，弱侧由不对称率推导） */
function AsymmetryDumbbell({ record }: { record: ComboRecord }) {
  const athlete = ATHLETES.find((a) => a.id === record.athleteId);
  const dominant = athlete?.dominantLeg ?? '右';
  const st = asymmetryStatus(record.asymmetry);
  const weak = Math.round((1 - record.asymmetry / 100) * 1000) / 10;
  const leftVal = dominant === '左' ? 100 : weak;
  const rightVal = dominant === '右' ? 100 : weak;
  const color = st === 'green' ? '#16A34A' : st === 'amber' ? '#D97706' : '#DC2626';

  return (
    <div className={cn('rounded-xl border p-3.5', st === 'red' ? 'border-risk/30 bg-risk-bg/40' : 'border-line bg-canvas/50')}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-text-2">左右侧峰值力（相对指数 · 强侧=100）</span>
        <span
          className={cn('rounded-full px-2 py-0.5 font-mono-data text-xs font-semibold', st === 'red' && 'relative')}
          style={{ color, background: `${color}14` }}
        >
          Δ {record.asymmetry.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-2">
        <DumbbellBar label="左腿" val={leftVal} color={color} />
        <DumbbellBar label="右腿" val={rightVal} color={color} />
      </div>
      {st === 'red' && (
        <motion.p
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-risk/30 bg-risk-bg px-2.5 py-1.5 text-xs font-medium text-risk"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          建议介入单侧力量矫正（联动医疗）
        </motion.p>
      )}
    </div>
  );
}

interface ProfilePanelProps {
  record: ComboRecord;
  canEdit: boolean;
  onToast: (msg: string, kind?: 'success' | 'info' | 'warning') => void;
}

export default function ProfilePanel({ record, canEdit, onToast }: ProfilePanelProps) {
  const athlete = ATHLETES.find((a) => a.id === record.athleteId);
  const session = COMBO_SESSIONS.find((s) => s.athleteIds.includes(record.athleteId));
  const verdict = pviVerdict(record.pvi);

  const stats: { label: string; value: string }[] = [
    { label: 'CMJ 纵跳', value: `${record.cmj.toFixed(1)} cm` },
    { label: 'RSImod', value: record.rsiMod.toFixed(2) },
    { label: '10m 冲刺', value: `${record.sprint10m.toFixed(2)} s` },
    { label: '30m 冲刺', value: `${record.sprint30m.toFixed(2)} s` },
    { label: '505 变向', value: `${record.cod505.toFixed(2)} s` },
    { label: 'COD 赤字', value: `${record.codDeficit.toFixed(2)} s` },
  ];

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-3.5">
        <h3>运动员高阶画像</h3>
      </div>
      <motion.div
        key={record.athleteId}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex-1 space-y-5 p-5"
      >
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <Avatar name={athlete?.name ?? '?'} group={athlete?.group} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-text-1">{athlete?.name}</span>
              {athlete && <AgeBadge group={athlete.group} />}
            </div>
            <p className="text-xs text-text-3">
              会话批次 <span className="font-mono-data text-brand-600">{session?.id ?? '—'}</span> · {record.date}
            </p>
          </div>
        </div>

        {/* PVI 仪表盘 */}
        <div className="rounded-xl border border-line bg-canvas/50 p-4">
          <PviGauge value={record.pvi} />
          <div className="mt-1 text-center">
            <StatusBadge tone={verdict.tone} label={verdict.label} pulse={false} />
          </div>
        </div>

        {/* 左右侧差异哑铃图 */}
        <AsymmetryDumbbell record={record} />

        {/* 原始指标网格 */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-line px-2.5 py-2">
              <p className="text-[11px] text-text-3">{s.label}</p>
              <p className="mt-0.5 font-mono-data text-[13px] font-semibold text-text-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={canEdit ? () => onToast(`已将 ${athlete?.name} 加入复测计划（演示）`) : undefined}
            disabled={!canEdit}
            title={canEdit ? undefined : '仅体能师可操作（演示 RBAC）'}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-4 text-xs font-medium text-white transition-all duration-150 hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            加入复测计划
          </button>
          <Link
            to="/trends"
            className="flex h-9 items-center gap-1 rounded-lg border border-line px-3.5 text-xs font-medium text-text-2 transition-colors hover:border-brand-600 hover:text-brand-600"
          >
            查看纵向趋势
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
