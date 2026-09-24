/**
 * SkillsTab — 档案 Tab4「专项技能诊断」（roster.md §B Tab4）
 * 技能雷达（本人 vs 位置常模）+ 子弹图明细卡网格 + 教练评语卡
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareQuote } from 'lucide-react';
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { ChartCard } from '@/components/common';
import { POSITION_LABEL } from '@/data';
import type { Athlete } from '@/data';
import { DarkTooltip, TooltipRow } from './chartTheme';
import { SKILL_STATUS_STYLE, skillScores } from './utils';

/** 子弹图：灰带 = 常模区间，黑竖线 = 本人得分（量程 40–100） */
function SkillBullet({ score, normLo, normHi }: { score: number; normLo: number; normHi: number }) {
  const MIN = 40;
  const MAX = 100;
  const toPct = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;
  return (
    <div className="relative h-2.5 w-full overflow-visible rounded-full bg-[#EEF2F7]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-y-0 rounded-full bg-[#CBD5E1]"
        style={{ left: toPct(normLo), width: `${((normHi - normLo) / (MAX - MIN)) * 100}%` }}
      />
      <motion.span
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-text-1"
        style={{ left: `calc(${toPct(score)} - 1.5px)` }}
      />
    </div>
  );
}

export default function SkillsTab({ athlete }: { athlete: Athlete }) {
  const skills = useMemo(() => skillScores(athlete), [athlete]);
  const radarData = skills.map((s) => ({
    dim: s.name,
    athlete: s.score,
    norm: Math.round((s.normLo + s.normHi) / 2),
  }));
  const avg = Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length);

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* 技能雷达 */}
      <ChartCard
        title="专项技能雷达"
        subtitle={`百分制 · 虚线为 ${POSITION_LABEL[athlete.position]}位置常模`}
        className="col-span-12 lg:col-span-5"
      >
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid stroke="#EEF2F7" />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 12, fill: '#475569' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={athlete.name} dataKey="athlete" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.25} strokeWidth={2.5} animationDuration={800} />
            <Radar name="位置常模" dataKey="norm" stroke="#94A3B8" strokeDasharray="5 4" fill="none" strokeWidth={1.5} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <DarkTooltip title={String(payload[0]?.payload?.dim ?? '')}>
                {payload.map((p) => (
                  <TooltipRow key={String(p.dataKey)} color={String(p.color)} name={String(p.name)} value={`${p.value} 分`} />
                ))}
              </DarkTooltip>
            ) : null} />
          </RadarChart>
        </ResponsiveContainer>
        <p className="text-center text-xs text-text-3">
          综合评分 <span className="font-mono-data text-base font-bold text-text-1">{avg}</span> / 100
        </p>
      </ChartCard>

      {/* 技能明细卡网格 2×3 */}
      <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:col-span-7">
        {skills.map((s, i) => {
          const st = SKILL_STATUS_STYLE[s.status];
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="rounded-[14px] border border-line bg-white p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-1">{s.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ color: st.color, background: st.bg }}
                >
                  {st.label}
                </span>
              </div>
              <p className="mt-2 font-mono-data text-2xl font-bold leading-7 text-text-1 tnum">
                {s.score}
                <span className="ml-1 text-xs font-medium text-text-3">分</span>
              </p>
              <div className="mt-3">
                <SkillBullet score={s.score} normLo={s.normLo} normHi={s.normHi} />
                <div className="mt-1.5 flex justify-between text-[10px] text-text-3">
                  <span>40</span>
                  <span className="font-mono-data">
                    常模 {s.normLo}–{s.normHi}
                  </span>
                  <span>100</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 教练评语 */}
      <div className="col-span-12 rounded-[14px] border border-line bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <MessageSquareQuote className="h-5 w-5 text-brand-600" />
          </span>
          <div>
            <h3>教练评语</h3>
            <p className="mt-1.5 text-sm leading-6 text-text-2">
              第一脚触球质量稳定，比赛中的接应选位意识突出。建议加强逆足传球精度训练，并在高强度对抗下巩固盘带稳定性。
            </p>
            <p className="mt-2 text-xs text-text-3">—— 韩建国（青训总监），2025-06-10</p>
          </div>
        </div>
      </div>
    </div>
  );
}
