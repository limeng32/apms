/**
 * ComboLeaderboard — 组合测试成绩榜（combo-testing.md §4.1）
 * 按 PVI 降序；PVI 内联子弹条（常模均值刻度 75）；不对称三态着色；行点击联动右侧画像
 */

import { motion } from 'framer-motion';
import { Avatar, AgeBadge } from '@/components/common';
import { ATHLETES, asymmetryStatus } from '@/data';
import type { ComboRecord } from '@/data';
import { cn } from '@/lib/utils';

const PVI_NORM = 75;

const ASYM_COLOR = { green: '#16A34A', amber: '#D97706', red: '#DC2626' } as const;

interface ComboLeaderboardProps {
  records: ComboRecord[];
  selectedId: string;
  onSelect: (athleteId: string) => void;
}

export default function ComboLeaderboard({ records, selectedId, onSelect }: ComboLeaderboardProps) {
  const nameOf = (id: string) => ATHLETES.find((a) => a.id === id)?.name ?? id;
  const groupOf = (id: string) => ATHLETES.find((a) => a.id === id)?.group;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3>组合测试成绩榜</h3>
          <p className="mt-0.5 text-xs text-text-3">按 PVI 降序 · 点击行联动右侧高阶画像</p>
        </div>
        <span className="text-xs text-text-3">{records.length} 人参测</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-text-3">
              <th className="px-5 py-2.5">运动员</th>
              <th className="px-3 py-2.5 text-right">CMJ</th>
              <th className="px-3 py-2.5 text-right">RSImod</th>
              <th className="px-3 py-2.5 text-right">10m</th>
              <th className="px-3 py-2.5 text-right">30m</th>
              <th className="px-3 py-2.5">PVI</th>
              <th className="px-3 py-2.5 text-right">不对称</th>
              <th className="px-5 py-2.5 text-right">COD赤字</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const st = asymmetryStatus(r.asymmetry);
              const group = groupOf(r.athleteId);
              const active = selectedId === r.athleteId;
              return (
                <motion.tr
                  key={r.athleteId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.04 }}
                  onClick={() => onSelect(r.athleteId)}
                  className={cn(
                    'h-12 cursor-pointer border-b border-line transition-colors duration-100 last:border-0',
                    active ? 'bg-brand-50' : 'hover:bg-[#F8FAFF]',
                  )}
                >
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={nameOf(r.athleteId)} group={group} size={28} />
                      <span className="text-sm font-medium text-text-1">{nameOf(r.athleteId)}</span>
                      {group && <AgeBadge group={group} />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-data text-cell-num text-text-1">{r.cmj.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono-data text-cell-num text-text-1">{r.rsiMod.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono-data text-cell-num text-text-1">{r.sprint10m.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono-data text-cell-num text-text-1">{r.sprint30m.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono-data text-[15px] font-bold"
                        style={{ color: r.pvi >= PVI_NORM ? '#2563EB' : '#475569' }}
                      >
                        {r.pvi}
                      </span>
                      {/* 子弹条：0–100 + 常模刻度 75 */}
                      <span className="relative h-1.5 w-20 rounded-full bg-[#EEF2F7]">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${r.pvi}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + i * 0.04 }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: r.pvi >= PVI_NORM ? 'linear-gradient(90deg,#2563EB,#06B6D4)' : '#94A3B8' }}
                        />
                        <span
                          className="absolute -top-0.5 h-2.5 w-px bg-text-3"
                          style={{ left: `${PVI_NORM}%` }}
                          title="常模均值 75"
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono-data text-cell-num font-medium" style={{ color: ASYM_COLOR[st] }}>
                      {r.asymmetry.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right font-mono-data text-cell-num text-text-2">
                    {r.codDeficit.toFixed(2)}s
                  </td>
                </motion.tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-xs text-text-3">
                  该会话暂无已采成绩记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
