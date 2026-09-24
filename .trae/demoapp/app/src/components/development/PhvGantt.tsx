/**
 * PhvGantt — PHV 窗口甘特图（development.md §4 中部通栏，核心视觉）
 * 纯 div 轨道绘制：浅蓝=年龄进度，紫色高亮段=PHV 窗口（±1 岁），◆=当前年龄
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartCard, Avatar } from '@/components/common';
import { ATHLETES, inPhvWindow, GROUP_COLOR, PHV_WATCH_IDS, type Athlete } from '@/data';
import { currentAge, windowRemainingMonths, growthSeries } from './devUtils';

const AXIS_MIN = 12;
const AXIS_MAX = 19;
const SPAN = AXIS_MAX - AXIS_MIN;

const pct = (age: number) => `${(Math.min(Math.max(age, AXIS_MIN), AXIS_MAX) - AXIS_MIN) / SPAN * 100}%`;

export default function PhvGantt() {
  const [showAll, setShowAll] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = showAll ? [...ATHLETES] : inPhvWindow();
    return list.sort((a, b) => a.phvAge - b.phvAge);
  }, [showAll]);

  return (
    <ChartCard
      title="PHV 窗口甘特图"
      subtitle={`X 轴 = 年龄 ${AXIS_MIN}–${AXIS_MAX} 岁 · 紫色段 = PHV 窗口（PHV 年龄 ±1 岁）· ◆ = 当前年龄`}
      className="mt-5"
      actions={
        <button
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {showAll ? <>收起 <ChevronUp className="h-3.5 w-3.5" /></> : <>显示全部 24 人 <ChevronDown className="h-3.5 w-3.5" /></>}
        </button>
      }
    >
      {/* 轴刻度 */}
      <div className="mb-1 flex pl-[128px] pr-[92px]">
        {Array.from({ length: SPAN + 1 }, (_, i) => AXIS_MIN + i).map((t, i) => (
          <span key={t} className="flex-1 text-center font-mono-data text-[10px] text-text-3 tnum" style={{ marginLeft: i === 0 ? -8 : 0 }}>
            {t}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((a, i) => {
          const age = currentAge(a);
          const inWindow = Math.abs(a.maturityOffset) <= 1;
          const watch = PHV_WATCH_IDS.includes(a.id);
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.25 }}
              className={cn('relative flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors', hoveredId === a.id && 'bg-brand-50/70')}
              onMouseEnter={() => setHoveredId(a.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 姓名列 */}
              <div className="flex w-[116px] shrink-0 items-center gap-2">
                <Avatar name={a.name} group={a.group} size={24} />
                <span className="truncate text-xs font-medium text-text-1">{a.name}</span>
                {watch && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B5CF6]" />}
              </div>

              {/* 轨道 */}
              <div className="relative h-5 flex-1 rounded-full bg-canvas">
                {/* PHV 窗口段 */}
                <div
                  className={cn('absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full', inWindow && 'animate-pulse motion-reduce:animate-none')}
                  style={{
                    left: pct(a.phvAge - 1),
                    width: `calc(${pct(a.phvAge + 1)} - ${pct(a.phvAge - 1)})`,
                    background: 'rgba(139,92,246,0.35)',
                    boxShadow: inWindow ? '0 0 10px rgba(139,92,246,0.35)' : undefined,
                  }}
                />
                {/* 年龄进度细条 */}
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                  style={{ left: 0, width: pct(age), background: GROUP_COLOR[a.group] + '55' }}
                />
                {/* 当前年龄菱形 */}
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-white shadow-card"
                  style={{ left: pct(age), background: GROUP_COLOR[a.group] }}
                />
              </div>

              {/* PHV 年龄标注 */}
              <span className="w-[80px] shrink-0 text-right font-mono-data text-[11px] text-text-2 tnum">
                PHV {a.phvAge.toFixed(1)}岁
              </span>

              {/* 悬停浮卡 */}
              <AnimatePresence>
                {hoveredId === a.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-24 top-full z-20 w-64 rounded-xl border border-line bg-white p-3 shadow-lift"
                  >
                    <p className="text-xs font-semibold text-text-1">
                      {a.name} · {a.group} · 当前 {age.toFixed(1)} 岁
                    </p>
                    <MiniHeightCurve athlete={a} />
                    <p className="mt-1.5 flex justify-between text-[11px] text-text-2">
                      <span>预测成年身高 <b className="font-mono-data tnum">{a.predictedHeight}cm</b></span>
                      <span>
                        {windowRemainingMonths(a) >= 0 ? (
                          <>窗口剩余 <b className="font-mono-data text-[#8B5CF6] tnum">{windowRemainingMonths(a)}</b> 月</>
                        ) : (
                          <span className="text-text-3">已越过 PHV 窗口</span>
                        )}
                      </span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-text-3">
        默认显示 PHV ±1 年窗口内 {inPhvWindow().length} 人 · 紫色段呼吸辉光 = 当前处于窗口内 · <span className="text-[#8B5CF6]">●</span> 敏感期重点监控
      </p>
    </ChartCard>
  );
}

/** 悬停浮卡中的身高曲线 mini（模型推导 12 月序列） */
function MiniHeightCurve({ athlete }: { athlete: Athlete }) {
  const series = useMemo(() => growthSeries(athlete), [athlete]);
  const w = 232;
  const h = 44;
  const min = Math.min(...series.map((p) => p.height)) - 1;
  const max = Math.max(...series.map((p) => p.height)) + 1;
  const pts = series
    .map((p, i) => `${(i / (series.length - 1)) * w},${h - 3 - ((p.height - min) / (max - min)) * (h - 6)}`)
    .join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="mt-1.5">
      <polyline points={pts} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeLinejoin="round" />
      {series.map((p, i) =>
        i === series.length - 1 ? (
          <circle key={p.month} cx={w} cy={h - 3 - ((p.height - min) / (max - min)) * (h - 6)} r={3} fill="#8B5CF6" />
        ) : null,
      )}
    </svg>
  );
}
