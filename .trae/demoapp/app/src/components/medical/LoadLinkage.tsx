/**
 * LoadLinkage — 康复负荷联动（medical.md §5 底部通栏）
 * 活跃伤员本周训练负荷上限表：上限=慢性负荷（28 天滚动均值），实际=本周急性负荷，灯=ACWR 分区
 */

import { useMemo } from 'react';
import { Hospital, Zap } from 'lucide-react';
import { ChartCard } from '@/components/common';
import { ATHLETE_ACWR, activeInjuries, getAthlete, acwrZone } from '@/data';

interface Row {
  id: string;
  name: string;
  group: string;
  cap: number;
  actual: number;
  acwr: number;
  zone: 'green' | 'amber' | 'red';
}

const ZONE_DOT: Record<Row['zone'], string> = { green: '#16A34A', amber: '#D97706', red: '#DC2626' };

export default function LoadLinkage() {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const inj of activeInjuries()) {
      const series = ATHLETE_ACWR[inj.athleteId];
      if (!series) continue;
      const a = getAthlete(inj.athleteId);
      const last = series[series.length - 1];
      out.push({
        id: inj.athleteId,
        name: a?.name ?? inj.athleteId,
        group: a?.group ?? '',
        cap: Math.round(last.chronic / 10) * 10,
        actual: last.acute,
        acwr: last.acwr,
        zone: acwrZone(last.acwr),
      });
      if (out.length >= 5) break;
    }
    return out;
  }, []);

  const overCount = rows.filter((r) => r.zone !== 'green').length;

  return (
    <ChartCard
      title="康复负荷联动"
      subtitle="活跃伤员本周训练负荷上限监控（上限 = 慢性负荷 28 天滚动均值，演示口径）"
      className="mt-5"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
          <Hospital className="h-3.5 w-3.5" /> ↔ <Zap className="h-3.5 w-3.5" /> 医疗与训练负荷联动中
        </span>
      }
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-text-3">
            <th className="py-2 pr-2 font-semibold">运动员</th>
            <th className="py-2 pr-2 text-right font-semibold">负荷上限 AU</th>
            <th className="py-2 pr-2 text-right font-semibold">本周实际</th>
            <th className="py-2 pr-2 font-semibold" style={{ minWidth: 160 }}>负荷占用</th>
            <th className="py-2 text-right font-semibold">状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pctVal = Math.min(100, Math.round((r.actual / r.cap) * 100));
            return (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-[#F8FAFF]">
                <td className="py-2.5 pr-2">
                  <span className="text-sm font-medium text-text-1">{r.name}</span>
                  <span className="ml-1.5 text-xs text-text-3">{r.group}</span>
                </td>
                <td className="py-2.5 pr-2 text-right font-mono-data text-[13px] text-text-2 tnum">{r.cap}</td>
                <td className="py-2.5 pr-2 text-right font-mono-data text-[13px] font-semibold text-text-1 tnum">{r.actual}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#EEF2F7]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pctVal}%`, background: ZONE_DOT[r.zone] }}
                      />
                    </div>
                    <span className="font-mono-data text-[11px] text-text-3 tnum">{pctVal}%</span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: ZONE_DOT[r.zone] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ZONE_DOT[r.zone] }} />
                    {r.zone === 'green' ? '正常' : r.zone === 'amber' ? '偏高' : '超限'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {overCount > 0 && (
        <p className="mt-3 rounded-lg bg-warn-bg/60 px-3 py-2 text-xs text-warn">
          {overCount} 名伤员本周负荷高于 ACWR 最佳区间，已自动推送体能师调整训练计划（演示）。
        </p>
      )}
    </ChartCard>
  );
}
