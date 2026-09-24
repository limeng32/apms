/**
 * HeightBoard — 预测成年身高榜（development.md §5.1 左卡）
 * 排名 / 运动员 / 当前身高 / 预测成年身高 / 达成率进度 / 成熟度组
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ChartCard, Avatar, AgeBadge, ProgressBar } from '@/components/common';
import { ATHLETES, maturityBand, MATURITY_LABEL, type MaturityBand } from '@/data';

const BAND_STYLE: Record<MaturityBand, { color: string; bg: string }> = {
  late: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  onTime: { color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  early: { color: '#D97706', bg: 'rgba(245,158,11,0.12)' },
};

export default function HeightBoard() {
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(
    () => [...ATHLETES].sort((a, b) => b.predictedHeight - a.predictedHeight),
    [],
  );
  const list = expanded ? ranked : ranked.slice(0, 8);

  return (
    <ChartCard
      title="预测成年身高榜"
      subtitle="Khamis-Roche 无骨龄预测法 · 误差 ±4cm（演示口径）"
      className="lg:col-span-5"
      actions={
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {expanded ? <>收起 <ChevronUp className="h-3.5 w-3.5" /></> : <>展开全部 24 人 <ChevronDown className="h-3.5 w-3.5" /></>}
        </button>
      }
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-text-3">
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">运动员</th>
            <th className="py-2 pr-2 text-right font-semibold">当前身高</th>
            <th className="py-2 pr-2 text-right font-semibold">预测成年</th>
            <th className="py-2 pr-2 font-semibold" style={{ minWidth: 110 }}>达成率</th>
            <th className="py-2 text-right font-semibold">组</th>
          </tr>
        </thead>
        <tbody>
          {list.map((a, i) => {
            const band = maturityBand(a);
            const rate = Math.round((a.height / a.predictedHeight) * 1000) / 10;
            return (
              <motion.tr
                key={a.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className="border-b border-line/60 transition-colors last:border-0 hover:bg-[#F8FAFF]"
              >
                <td className="py-2.5 pr-2 font-mono-data text-xs text-text-3 tnum">{i + 1}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={a.name} group={a.group} size={26} />
                    <span className="text-sm font-medium text-text-1">{a.name}</span>
                    <AgeBadge group={a.group} />
                  </div>
                </td>
                <td className="py-2.5 pr-2 text-right font-mono-data text-[13px] text-text-2 tnum">{a.height}</td>
                <td className="py-2.5 pr-2 text-right font-mono-data text-[13px] font-semibold text-text-1 tnum">{a.predictedHeight}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={rate} tone={rate >= 97 ? 'green' : rate >= 93 ? 'blue' : 'amber'} className="w-16" />
                    <span className="font-mono-data text-[11px] text-text-2 tnum">{rate}%</span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ color: BAND_STYLE[band].color, background: BAND_STYLE[band].bg }}
                  >
                    {MATURITY_LABEL[band]}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </ChartCard>
  );
}
