/**
 * TeamLoadCard — 全队负荷与 ACWR 趋势（近 12 周）（dashboard.md §5.1）
 * ComposedChart 双轴：柱=全队平均周负荷 AU（蓝，左轴）；线=平均 ACWR（右轴，数据点按分区着色）
 * 数据：TEAM_ACWR；analyst 角色含"导出数据"演示按钮
 */

import { useMemo } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard, useToast } from '@/components/common';
import { ACWR_ZONES, TEAM_ACWR } from '@/data';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import DashTooltip from './DashTooltip';
import { BIG_CARD, STATUS, acwrTone, axisProps  } from './theme';

function fmtWeek(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}.${Number(d)}`;
}

interface ZoneDotProps {
  cx?: number;
  cy?: number;
  payload?: { acwr?: number };
}

/** ACWR 折线数据点：按分区着色（绿区间 cyan 系、超区间 amber/red） */
function ZoneDot({ cx = 0, cy = 0, payload }: ZoneDotProps) {
  const v = payload?.acwr ?? 1;
  const tone = acwrTone(v);
  const color = tone === 'green' ? '#06B6D4' : tone === 'amber' ? STATUS.amber : STATUS.red;
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.2} />;
}

export default function TeamLoadCard({ big, className }: { big?: boolean; className?: string }) {
  const { role } = useRole();
  const { toast } = useToast();

  const data = useMemo(
    () =>
      TEAM_ACWR.slice(-12).map((p) => ({
        ...p,
        weekLabel: fmtWeek(p.week),
        zone: ACWR_ZONES.find((z) => p.acwr >= z.min && p.acwr <= z.max)?.label ?? '—',
      })),
    [],
  );

  return (
    <ChartCard
      title="全队负荷与 ACWR 趋势（近 12 周）"
      subtitle="柱=平均周负荷 AU（左轴）· 线=平均 ACWR（右轴）"
      className={cn(className, big && BIG_CARD)}
      actions={
        <>
          {role === 'analyst' && (
            <button
              onClick={() => toast('负荷数据导出成功（演示）', 'success')}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors',
                big
                  ? 'border-ink-700 text-white/70 hover:bg-white/5'
                  : 'border-line text-text-2 hover:bg-slate-50',
              )}
            >
              <Download className="h-3.5 w-3.5" />
              导出数据
            </button>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono-data text-xs',
              big ? 'border-ink-700 text-white/70' : 'border-line text-text-2',
            )}
          >
            12 周
            <ChevronDown className="h-3 w-3" />
          </span>
        </>
      }
    >
      <div className="h-[264px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="weekLabel" {...axisProps(!!big)} />
            <YAxis yAxisId="left" orientation="left" domain={[0, 3000]} width={40} {...axisProps(!!big)} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0.6, 1.4]}
              width={32}
              tickFormatter={(v: number) => v.toFixed(1)}
              {...axisProps(!!big)}
            />
            {/* 最佳区间 0.8–1.3 淡绿横带（右轴） */}
            <ReferenceArea yAxisId="right" y1={0.8} y2={1.3} fill="#16A34A" fillOpacity={big ? 0.14 : 0.08} />
            <Tooltip
              cursor={{ fill: big ? 'rgba(255,255,255,0.04)' : '#F8FAFF' }}
              content={
                <DashTooltip
                  title={(_, payload) => {
                    const p = payload?.[0]?.payload as { weekLabel?: string } | undefined;
                    return `${p?.weekLabel ?? ''} 当周`;
                  }}
                  formatter={(item) =>
                    item.dataKey === 'acute'
                      ? { name: '周负荷', value: `${item.value} AU`, color: '#3B82F6' }
                      : {
                          name: 'ACWR',
                          value: Number(item.value).toFixed(2),
                          color:
                            acwrTone(Number(item.value)) === 'green'
                              ? '#06B6D4'
                              : acwrTone(Number(item.value)) === 'amber'
                                ? STATUS.amber
                                : STATUS.red,
                        }
                  }
                />
              }
            />
            <Bar yAxisId="left" dataKey="acute" name="周负荷" fill="#3B82F6" fillOpacity={big ? 0.9 : 0.85} radius={[6, 6, 0, 0]} barSize={20} animationDuration={700} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="acwr"
              name="ACWR"
              stroke="#06B6D4"
              strokeWidth={2.5}
              dot={<ZoneDot />}
              activeDot={{ r: 5 }}
              animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
