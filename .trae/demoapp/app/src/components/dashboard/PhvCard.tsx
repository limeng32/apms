/**
 * PhvCard — PHV 发育阶段分布（dashboard.md §4.2）
 * 数据：ATHLETES.maturityOffset 分桶 + inPhvWindow()/PHV_WATCH_IDS
 * 分桶口径：前期 <−1 · 接近期 −1~+0.5 · 高峰后 +0.5~+1.5 · 已越过 >+1.5（与设计稿 4/11/8/1 一致）
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '@/components/common';
import { ATHLETES, PHV_WATCH_IDS, inPhvWindow } from '@/data';
import { cn } from '@/lib/utils';
import DashTooltip from './DashTooltip';
import { BIG_CARD, axisProps  } from './theme';

const BANDS = [
  { key: 'pre', label: 'PHV 前期', test: (v: number) => v < -1, color: '#8B5CF6' },
  { key: 'near', label: '接近期', test: (v: number) => v >= -1 && v < 0.5, color: '#3B82F6' },
  { key: 'post', label: '高峰后', test: (v: number) => v >= 0.5 && v <= 1.5, color: '#06B6D4' },
  { key: 'beyond', label: '已越过', test: (v: number) => v > 1.5, color: '#22C55E' },
] as const;

export default function PhvCard({ big, className }: { big?: boolean; className?: string }) {
  const navigate = useNavigate();

  const data = useMemo(
    () =>
      BANDS.map((b) => ({
        key: b.key,
        label: b.label,
        color: b.color,
        count: ATHLETES.filter((a) => b.test(a.maturityOffset)).length,
      })),
    [],
  );

  const windowCount = inPhvWindow().length;

  return (
    <ChartCard title="PHV 发育阶段分布" className={cn(className, big && BIG_CARD)} bodyClassName="pt-4">
      <div className="h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }} barCategoryGap="24%">
            <XAxis dataKey="label" interval={0} {...axisProps(!!big)} />
            <YAxis allowDecimals={false} {...axisProps(!!big)} />
            <Tooltip
              cursor={{ fill: big ? 'rgba(255,255,255,0.04)' : '#F8FAFF' }}
              content={
                <DashTooltip
                  formatter={(item) => ({
                    name: String(item.payload?.label ?? ''),
                    value: `${item.value} 人`,
                    color: item.payload?.color as string,
                  })}
                />
              }
            />
            <Bar
              dataKey="count"
              radius={[6, 6, 0, 0]}
              animationDuration={700}
              barSize={40}
              onClick={(d) => {
                const band = (d as unknown as { key?: string })?.key;
                navigate(band ? `/development?band=${band}` : '/development');
              }}
              className="cursor-pointer"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className={cn('mt-3 border-t pt-3 text-xs leading-[18px]', big ? 'border-ink-700 text-white/50' : 'border-line text-text-3')}>
        {windowCount} 名处于 PHV ±1 年窗口内，其中 {PHV_WATCH_IDS.length} 名敏感期重点监控，建议匹配窗口期训练
      </p>
    </ChartCard>
  );
}
