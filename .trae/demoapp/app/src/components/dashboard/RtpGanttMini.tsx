/**
 * RtpGanttMini — 队医视角：康复进度甘特 mini（dashboard.md §6 doctor）
 * 8 条活跃伤病，5 阶段 RTP 分段条 + 预计复出日期；点击跳 /medical
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChartCard } from '@/components/common';
import { RTP_STAGES, activeInjuries, getAthlete } from '@/data';
import { cn } from '@/lib/utils';
import { BIG_CARD, STATUS } from './theme';

const KIND_COLOR: Record<string, string> = {
  停训: STATUS.red,
  限制: STATUS.amber,
  带伤训练: '#3B82F6',
  监控中: '#06B6D4',
};

export default function RtpGanttMini({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();

  const rows = useMemo(
    () =>
      activeInjuries().map((i) => ({
        injury: i,
        name: getAthlete(i.athleteId)?.name ?? i.athleteId,
      })),
    [],
  );

  return (
    <ChartCard
      title="康复进度甘特（RTP 五阶段）"
      subtitle={`${rows.length} 条活跃伤病 · 0 急性期 → 4 完全复出`}
      className={cn(className, big && BIG_CARD)}
      bodyClassName="pt-4"
      actions={
        <button
          onClick={() => navigate('/medical')}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
        >
          进入医疗康复
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        {rows.map(({ injury, name }, idx) => {
          const color = KIND_COLOR[injury.activeKind ?? '限制'] ?? STATUS.amber;
          return (
            <button
              key={injury.id}
              onClick={() => navigate(`/medical?injury=${injury.id}`)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                big ? 'hover:bg-white/5' : 'hover:bg-[#F8FAFF]',
              )}
            >
              <span className={cn('w-14 shrink-0 truncate text-xs font-medium', big ? 'text-white' : 'text-text-1')}>
                {name}
              </span>
              <span className={cn('hidden w-28 shrink-0 truncate text-[11px] md:block', big ? 'text-white/40' : 'text-text-3')}>
                {injury.type}
              </span>
              {/* 5 阶段分段条 */}
              <span className="flex min-w-0 flex-1 items-center gap-1">
                {RTP_STAGES.map((stage, s) => {
                  const done = s < injury.rtpStage;
                  const current = s === injury.rtpStage;
                  return (
                    <motion.span
                      key={stage}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 + idx * 0.05 + s * 0.04 }}
                      title={`${s} ${stage}`}
                      className={cn('h-2 flex-1 origin-left rounded-full', big ? 'bg-white/10' : 'bg-slate-100')}
                      style={
                        done || current
                          ? { background: color, opacity: done ? 1 : undefined }
                          : undefined
                      }
                    >
                      {current && (
                        <span className="block h-full w-full animate-pulse rounded-full" style={{ background: color }} />
                      )}
                    </motion.span>
                  );
                })}
              </span>
              <span className="shrink-0 font-mono-data text-[11px] tnum" style={{ color }}>
                {injury.rtpStage}/4
              </span>
              <span className={cn('hidden shrink-0 font-mono-data text-[11px] tnum sm:block', big ? 'text-white/40' : 'text-text-3')}>
                复出 {injury.estReturn.slice(5)}
              </span>
            </button>
          );
        })}
      </div>
      {/* 阶段图例 */}
      <div className={cn('mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[11px]', big ? 'border-ink-700 text-white/40' : 'border-line text-text-3')}>
        {RTP_STAGES.map((s, i) => (
          <span key={s}>{i} {s}</span>
        ))}
      </div>
    </ChartCard>
  );
}
