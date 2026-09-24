/**
 * BioBanding — 成熟度分组视图（development.md §3.2 右卡）
 * 晚熟 / 正常 / 早熟 三组；正常组默认折叠为头像墙；CTA 生成分组建议
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartCard, Avatar, useToast } from '@/components/common';
import { ATHLETES, maturityBand, type Athlete, type MaturityBand } from '@/data';

interface BioBandingProps {
  canGenerate: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

const GROUPS: {
  key: MaturityBand;
  title: string;
  color: string;
  bg: string;
  note?: string;
  defaultCollapsed?: boolean;
}[] = [
  { key: 'late', title: '晚熟组（偏移 < −1）', color: '#8B5CF6', bg: 'rgba(139,92,246,0.07)', note: '建议同组对抗训练，避免身体劣势挫伤信心' },
  { key: 'onTime', title: '正常组（−1 ~ +1）', color: '#2563EB', bg: 'rgba(37,99,235,0.06)', defaultCollapsed: true },
  { key: 'early', title: '早熟组（> +1）', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', note: '警惕早熟红利错觉，技术评估需去身体化' },
];

export default function BioBanding({ canGenerate, hoveredId, onHover }: BioBandingProps) {
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ onTime: true });

  const byBand = useMemo(() => {
    const m: Record<MaturityBand, Athlete[]> = { late: [], onTime: [], early: [] };
    for (const a of ATHLETES) m[maturityBand(a)].push(a);
    for (const k of Object.keys(m) as MaturityBand[]) m[k].sort((x, y) => x.maturityOffset - y.maturityOffset);
    return m;
  }, []);

  return (
    <ChartCard title="成熟度分组（Bio-Banding）" subtitle="按成熟度偏移分组 · 指导分组对抗" className="lg:col-span-5" bodyClassName="flex h-full flex-col p-4">
      <div className="flex flex-1 flex-col gap-3">
        {GROUPS.map((g, gi) => {
          const members = byBand[g.key];
          const isCollapsed = collapsed[g.key] ?? false;
          return (
            <motion.section
              key={g.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.08, duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden rounded-xl border border-line"
            >
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [g.key]: !isCollapsed }))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                style={{ background: g.bg }}
              >
                <span className="h-8 w-1 rounded-full" style={{ background: g.color }} />
                <span className="text-sm font-semibold" style={{ color: g.color }}>{g.title}</span>
                <span
                  className="rounded-full px-1.5 py-px font-mono-data text-[11px] font-semibold tnum"
                  style={{ background: g.color + '1A', color: g.color }}
                >
                  {members.length} 人
                </span>
                <span className="ml-auto text-text-3">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </span>
              </button>

              {isCollapsed ? (
                <div className="flex flex-wrap gap-1.5 px-3.5 py-3">
                  {members.map((a) => (
                    <span key={a.id} title={`${a.name} · 偏移 ${a.maturityOffset}`}>
                      <Avatar name={a.name} group={a.group} size={30} />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col px-2 py-1.5">
                  {members.map((a) => (
                    <div
                      key={a.id}
                      onMouseEnter={() => onHover(a.id)}
                      onMouseLeave={() => onHover(null)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                        hoveredId === a.id ? 'bg-brand-50' : 'hover:bg-canvas',
                      )}
                    >
                      <Avatar name={a.name} group={a.group} size={26} />
                      <span className="text-sm text-text-1">{a.name}</span>
                      <span className="text-xs text-text-3">{a.group}</span>
                      <span className="ml-auto font-mono-data text-xs font-medium text-text-2 tnum">
                        {a.maturityOffset > 0 ? '+' : ''}{a.maturityOffset} 岁
                      </span>
                      <span className="w-14 text-right font-mono-data text-xs text-text-3 tnum">→ {a.predictedHeight}cm</span>
                    </div>
                  ))}
                  {g.note && (
                    <p className="mx-2 mb-1.5 mt-1 rounded-lg px-2.5 py-2 text-xs leading-5" style={{ background: g.bg, color: g.color }}>
                      注：{g.note}
                    </p>
                  )}
                </div>
              )}
            </motion.section>
          );
        })}
      </div>

      <button
        disabled={!canGenerate}
        title={canGenerate ? undefined : '当前角色无生成建议权限（仅主教练 / 科研人员）'}
        onClick={() => toast('已生成分组建议（演示）')}
        className={cn(
          'mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all',
          canGenerate
            ? 'bg-btn-brand text-white hover:bg-btn-brand-hover active:scale-[0.97]'
            : 'cursor-not-allowed bg-canvas text-text-3',
        )}
      >
        <Sparkles className="h-4 w-4" /> 生成本期 Bio-Banding 分组训练建议
      </button>
    </ChartCard>
  );
}
