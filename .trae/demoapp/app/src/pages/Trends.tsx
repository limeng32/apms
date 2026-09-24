/**
 * 纵向趋势分析 `/trends`（trends.md）
 * 运动员 × 指标 × 时间窗选择器 + 主图（常模带/事件标记）+ 三洞察卡 + Small Multiples
 */

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Users } from 'lucide-react';
import { ChartCard, useToast } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { getAthlete } from '@/data';
import SelectorBar from '@/components/trends/SelectorBar';
import MainChart from '@/components/trends/MainChart';
import InsightCards from '@/components/trends/InsightCards';
import SmallMultiples from '@/components/trends/SmallMultiples';
import { BODY_TREND_METRICS, CORE_TREND_METRICS } from '@/components/trends/trendUtils';
import type { TimeWindow, TrendMetric } from '@/components/trends/trendUtils';
import { cn } from '@/lib/utils';

export default function Trends() {
  const { toast } = useToast();
  const { role } = useRole();
  const isDoctor = role === 'doctor';

  const [athleteIds, setAthleteIds] = useState<string[]>(['A05']);
  const [metricKey, setMetricKey] = useState<string>(CORE_TREND_METRICS[0].key); // Yo-Yo IR1
  const [window_, setWindow] = useState<TimeWindow>(8);
  const [showNorm, setShowNorm] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [compareMode, setCompareMode] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  // 当前角色可用指标集；队医切换到受限视图时自动回落到首个允许指标（派生，无需 effect）
  const allowedMetrics = isDoctor ? BODY_TREND_METRICS : CORE_TREND_METRICS;
  const metric = allowedMetrics.find((m) => m.key === metricKey) ?? allowedMetrics[0];
  const setMetric = (m: TrendMetric) => setMetricKey(m.key);

  const athletes = athleteIds
    .map((id) => getAthlete(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .slice(0, compareMode ? 3 : 1);
  const primary = athletes[0];

  if (!primary) return null;

  const selectMetricAndTop = (m: TrendMetric) => {
    setMetric(m);
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>纵向趋势分析</h1>
          <p className="mt-1 text-sm text-text-2">近 8 次测试序列 · 分年龄组常模对照</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-text-2">
            <Users className="h-4 w-4" />
            对比模式
            <button
              role="switch"
              aria-checked={compareMode}
              onClick={() => setCompareMode((v) => !v)}
              className={cn('relative h-5 w-9 rounded-full transition-colors', compareMode ? 'bg-brand-600' : 'bg-line')}
            >
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', compareMode ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </label>
          <button
            onClick={() => toast('图表已导出 PNG（演示）')}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-text-2 shadow-card transition-all hover:bg-canvas active:scale-[0.97]"
          >
            <Download className="h-4 w-4" />
            导出图表
          </button>
        </div>
      </div>

      <SelectorBar
        athleteIds={athleteIds}
        onAthletesChange={setAthleteIds}
        metric={metric}
        onMetricChange={setMetric}
        window={window_}
        onWindowChange={setWindow}
        showNorm={showNorm}
        onShowNormChange={setShowNorm}
        showEvents={showEvents}
        onShowEventsChange={setShowEvents}
        compareMode={compareMode}
        isDoctor={isDoctor}
      />

      {/* 主图卡 */}
      <div ref={mainRef} className="scroll-mt-36">
        <ChartCard
          title="成绩趋势 vs 常模"
          subtitle={`${metric.name}（${metric.unit}）· ${window_ === 'all' ? '全部' : `近 ${window_} 次`} · 主选 ${primary.name}（${primary.group}）`}
          className="mt-4"
        >
          <motion.div
            key={`${metric.key}-${athletes.map((a) => a.id).join(',')}-${window_}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <MainChart athletes={athletes} metric={metric} window={window_} showNorm={showNorm} showEvents={showEvents} />
          </motion.div>
        </ChartCard>
      </div>

      {/* 三洞察卡 */}
      <div className="mt-5 grid grid-cols-12 gap-5">
        <InsightCards athlete={primary} metric={metric} window={window_} isDoctor={isDoctor} onMetricChange={setMetric} />
      </div>

      {/* Small Multiples */}
      <SmallMultiples athlete={primary} activeKey={metric.key} isDoctor={isDoctor} onSelect={selectMetricAndTop} />
    </div>
  );
}
