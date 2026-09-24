/**
 * AcwrAlertList — 超限预警列表（health-warning.md §4.1 右卡）
 * 按严重度排序，mini sparkline，处理建议按钮（队医/体能师可用）
 */

import { useMemo, useState } from 'react';
import { Bell, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartCard, Modal, useToast } from '@/components/common';
import {
  ACWR_ALERTS, getAthlete, athleteAcwrSeries, type AcwrAlert,
} from '@/data';

/** 建议措施（health-warning.md §4.1 表，按运动员） */
const ADVICE: Record<string, string> = {
  A23: '立即降负荷 20%，停高强度课',
  A09: '下调本周总量，避免连续高负荷日',
  A20: '监控肩部负荷，扑救减量',
  A03: '叠加髌腱病，控制跳跃量',
};

interface AcwrAlertListProps {
  /** 当前角色是否可采纳建议（doctor / fitness） */
  canAct: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

export default function AcwrAlertList({ canAct, hoveredId, onHover }: AcwrAlertListProps) {
  const { toast } = useToast();
  const [adviceFor, setAdviceFor] = useState<AcwrAlert | null>(null);

  const alerts = useMemo(
    () => [...ACWR_ALERTS].sort((a, b) => (a.status === b.status ? b.acwr - a.acwr : a.status === 'red' ? -1 : 1)),
    [],
  );

  return (
    <ChartCard title="超限预警列表" subtitle={`${alerts.length} 条 · 按严重度排序`} className="lg:col-span-5" bodyClassName="flex h-full flex-col p-4">
      <div className="flex flex-1 flex-col gap-2">
        {alerts.map((al) => {
          const a = getAthlete(al.athleteId);
          if (!a) return null;
          const series = athleteAcwrSeries(al.athleteId).slice(-6);
          const rising = series[series.length - 1].acwr > series[series.length - 2].acwr + 0.005;
          const flat = Math.abs(series[series.length - 1].acwr - series[series.length - 2].acwr) <= 0.005;
          const isRed = al.status === 'red';
          return (
            <div
              key={al.athleteId}
              onMouseEnter={() => onHover(al.athleteId)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'rounded-xl border p-3 transition-all duration-150',
                hoveredId === al.athleteId ? 'border-brand-500 shadow-card' : 'border-line',
                isRed ? 'bg-risk-bg/40' : 'bg-warn-bg/30',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {isRed && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />}
                  <span className={cn('relative inline-flex h-2 w-2 rounded-full', isRed ? 'bg-risk' : 'bg-warn')} />
                </span>
                <span className="text-sm font-semibold text-text-1">{a.name}</span>
                <span className="text-xs text-text-3">{a.group}</span>
                <span className={cn('ml-auto font-mono-data text-base font-bold tnum', isRed ? 'text-risk' : 'text-warn')}>
                  {al.acwr.toFixed(2)}
                </span>
                <Sparkline values={series.map((p) => p.acwr)} red={isRed} />
                <span className="flex w-8 items-center justify-end text-[11px] text-text-3">
                  {flat ? <Minus className="h-3.5 w-3.5" /> : (
                    <>
                      <TrendingUp className={cn('h-3.5 w-3.5', rising ? 'text-risk' : 'text-ok')} />
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 pl-4">
                <p className="text-xs text-text-2">{ADVICE[al.athleteId] ?? al.note}</p>
                <button
                  disabled={!canAct}
                  title={canAct ? undefined : '无操作权限'}
                  onClick={() => setAdviceFor(al)}
                  className={cn(
                    'shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                    canAct ? 'bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white' : 'cursor-not-allowed bg-canvas text-text-3',
                  )}
                >
                  处理建议
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => toast(`已推送 ${alerts.length} 条预警（演示）`, 'info')}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
      >
        <Bell className="h-4 w-4" /> 推送预警给教练组
      </button>

      {/* 建议详情 Modal */}
      <Modal open={!!adviceFor} onClose={() => setAdviceFor(null)} title="处理建议详情" width={440}>
        {adviceFor && (
          <div>
            {(() => {
              const a = getAthlete(adviceFor.athleteId);
              return (
                <>
                  <p className="text-sm text-text-2">
                    <span className="font-semibold text-text-1">{a?.name}</span> 当前 ACWR{' '}
                    <span className="font-mono-data font-bold text-risk tnum">{adviceFor.acwr.toFixed(2)}</span>，
                    {adviceFor.note}
                  </p>
                  <div className="mt-3 rounded-xl bg-canvas p-3.5 text-sm leading-6 text-text-1">
                    {ADVICE[adviceFor.athleteId]}
                  </div>
                  <button
                    onClick={() => {
                      toast(`已采纳 ${a?.name} 的负荷调整建议（演示）`);
                      setAdviceFor(null);
                    }}
                    className="mt-4 h-9 w-full rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
                  >
                    采纳建议
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </ChartCard>
  );
}

/** 迷你趋势线（近 6 周 ACWR） */
function Sparkline({ values, red }: { values: number[]; red: boolean }) {
  const w = 56;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={red ? '#DC2626' : '#D97706'} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}
