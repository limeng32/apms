/**
 * AcwrCard — ACWR 负荷预警（dashboard.md §4.3）
 * 迷你散点（X=慢性负荷, Y=ACWR，8 名重点运动员）+ 绿区 ReferenceArea + 红点 SMIL 脉冲
 * 数据：ATHLETE_ACWR（末点）+ ACWR_ALERTS + getAthlete()
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/common';
import { ACWR_ALERTS, ATHLETE_ACWR, getAthlete } from '@/data';
import { cn } from '@/lib/utils';
import DashTooltip from './DashTooltip';
import { BIG_CARD, STATUS, acwrTone, axisProps  } from './theme';

/** 设计稿建议文案（demo 演示口径，按预警级别/部位） */
const ADVICE: Record<string, string> = {
  A23: '立即降负荷 20%',
  A09: '下调本周量',
  A20: '监控肩部负荷',
};

interface ScatterDotProps {
  cx?: number;
  cy?: number;
  payload?: { tone: string };
}

/** 自定义散点：红状态叠加 SMIL 脉冲环（SVG 内 animate，2s 循环） */
function PulseDot({ cx = 0, cy = 0, payload }: ScatterDotProps) {
  const color = payload?.tone === 'red' ? STATUS.red : payload?.tone === 'amber' ? STATUS.amber : STATUS.green;
  return (
    <g>
      {payload?.tone === 'red' && (
        <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.4}>
          <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
    </g>
  );
}

export default function AcwrCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();

  const points = useMemo(
    () =>
      Object.entries(ATHLETE_ACWR).map(([id, s]) => {
        const last = s[s.length - 1];
        return {
          id,
          name: getAthlete(id)?.name ?? id,
          chronic: last.chronic,
          acwr: last.acwr,
          tone: acwrTone(last.acwr),
        };
      }),
    [],
  );

  const alerts = ACWR_ALERTS.slice(0, 3).map((a) => ({
    ...a,
    name: getAthlete(a.athleteId)?.name ?? a.athleteId,
  }));

  return (
    <ChartCard
      title="ACWR 负荷预警"
      className={cn(className, big && BIG_CARD)}
      bodyClassName="pt-4"
      actions={
        <button
          onClick={() => navigate('/health')}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600"
        >
          健康预警中心
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <XAxis
              type="number"
              dataKey="chronic"
              name="慢性负荷"
              domain={['dataMin - 200', 'dataMax + 200']}
              {...axisProps(!!big)}
            />
            <YAxis type="number" dataKey="acwr" name="ACWR" domain={[0.5, 1.8]} {...axisProps(!!big)} />
            {/* 最佳区间 0.8–1.3 淡绿横带 */}
            <ReferenceArea y1={0.8} y2={1.3} fill="#16A34A" fillOpacity={big ? 0.14 : 0.08} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: big ? '#1C2A45' : '#EEF2F7' }}
              content={
                <DashTooltip
                  title={(_, payload) => String(payload?.[0]?.payload?.name ?? '')}
                  formatter={(item) => ({
                    name: item.name === 'ACWR' ? 'ACWR' : '慢性负荷',
                    value: item.name === 'ACWR' ? Number(item.value).toFixed(2) : `${item.value} AU`,
                    color: STATUS[acwrTone(Number((item.payload as { acwr?: number })?.acwr ?? 1))],
                  })}
                />
              }
            />
            <Scatter data={points} shape={<PulseDot />} isAnimationActive animationDuration={700} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* 预警列表 */}
      <div className={cn('mt-2 flex flex-col gap-1 border-t pt-3', big ? 'border-ink-700' : 'border-line')}>
        {alerts.map((a) => (
          <button
            key={a.athleteId}
            onClick={() => navigate(`/health?athlete=${a.athleteId}`)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
              big ? 'hover:bg-white/5' : 'hover:bg-[#F8FAFF]',
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {a.status === 'red' && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: a.status === 'red' ? STATUS.red : STATUS.amber }}
              />
            </span>
            <span className={cn('text-xs font-medium', big ? 'text-white' : 'text-text-1')}>{a.name}</span>
            <span
              className="font-mono-data text-[13px] font-semibold tnum"
              style={{ color: a.status === 'red' ? STATUS.red : STATUS.amber }}
            >
              {a.acwr.toFixed(2)}
            </span>
            <span className={cn('ml-auto truncate text-[11px]', big ? 'text-white/50' : 'text-text-3')}>
              {ADVICE[a.athleteId] ?? a.note}
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
}
