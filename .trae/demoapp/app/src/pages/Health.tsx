/**
 * /health 健康预警中心 — RTP 红黄绿看板 + ACWR 急慢性负荷预警（health-warning.md）
 * RBAC：doctor 可处置；fitness 可采纳负荷建议；coach/analyst 只读
 */

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Download, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal, useToast, useCountUp } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import {
  RTP_STAGES, RTP_LABEL, ACWR_ALERTS, getAthlete,
  type Athlete, type Injury, type RTPStatus,
} from '@/data';
import RtpKanban, { kanbanCounts, type KanbanState } from '@/components/health/RtpKanban';
import HealthDrawer from '@/components/health/HealthDrawer';
import AcwrMatrix from '@/components/health/AcwrMatrix';
import AcwrAlertList from '@/components/health/AcwrAlertList';
import LoadTrend from '@/components/health/LoadTrend';

const WARNING_RULES: { rule: string; threshold: string; level: 'red' | 'amber' }[] = [
  { rule: 'ACWR 危险', threshold: '> 1.5', level: 'red' },
  { rule: 'ACWR 高风险', threshold: '1.3 – 1.5', level: 'amber' },
  { rule: '负荷不足', threshold: '< 0.8', level: 'amber' },
  { rule: '新增中重度伤病', threshold: '任意', level: 'red' },
  { rule: 'RTP 延期', threshold: '超预计复出日', level: 'amber' },
];

export default function Health() {
  const { role, roleInfo } = useRole();
  const { toast } = useToast();
  const canManage = role === 'doctor';
  const canAct = role === 'doctor' || role === 'fitness';
  const readOnly = role === 'coach' || role === 'analyst';

  const [state, setState] = useState<KanbanState>({ rtpOverrides: {}, stageOverrides: {} });
  const [highlight, setHighlight] = useState<'red' | 'amber' | 'green' | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const [hoveredAlert, setHoveredAlert] = useState<string | null>(null);
  const [stageEdit, setStageEdit] = useState<{ athlete: Athlete; injury: Injury } | null>(null);
  const [noteFor, setNoteFor] = useState<Athlete | null>(null);
  const [noteText, setNoteText] = useState('');
  const acwrRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => kanbanCounts(state), [state]);

  const moveAthlete = (athleteId: string, to: RTPStatus) => {
    const a = getAthlete(athleteId);
    setState((s) => ({ ...s, rtpOverrides: { ...s.rtpOverrides, [athleteId]: to } }));
    toast(`已将 ${a?.name ?? athleteId} 调整为「${RTP_LABEL[to]}」（演示）`);
  };

  const kpis = [
    { key: 'red' as const, icon: <ShieldAlert className="h-4 w-4 text-risk" />, label: '红色预警', value: counts.red, pulse: true, color: '#DC2626' },
    { key: 'amber' as const, icon: <AlertTriangle className="h-4 w-4 text-warn" />, label: '黄色关注', value: counts.amber, pulse: false, color: '#D97706' },
    { key: 'acwr' as const, icon: <Zap className="h-4 w-4 text-brand-600" />, label: 'ACWR 超限', value: ACWR_ALERTS.length, pulse: false, color: '#2563EB' },
    { key: 'done' as const, icon: <CheckCircle2 className="h-4 w-4 text-ok" />, label: '本周已处置', value: 3, pulse: false, color: '#16A34A' },
  ];

  const onKpiClick = (key: string) => {
    if (key === 'red' || key === 'amber') setHighlight((v) => (v === key ? null : (key as 'red' | 'amber')));
    if (key === 'acwr') acwrRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (key === 'done') toast('本周已处置 3 条预警（演示口径）', 'info');
  };

  return (
    <div>
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>健康预警中心</h1>
          <p className="mt-1 text-sm text-text-2">RTP 参训风险与训练负荷实时监控</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRulesOpen(true)}
            className="h-9 rounded-lg border border-line bg-white px-4 text-sm font-medium text-text-2 shadow-card transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            预警规则
          </button>
          <button
            onClick={() => toast('预警清单已导出（演示）', 'info')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            <Download className="h-4 w-4" /> 导出预警清单
          </button>
        </div>
      </div>

      {/* 只读角色提示条 */}
      {readOnly && (
        <div className="mb-4 rounded-xl border border-brand-500/25 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          当前为只读视图（角色：{roleInfo.name}）· 切换到队医角色可体验处置操作
        </div>
      )}

      {/* 顶部预警摘要条 */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <MiniKpi
            key={k.key}
            icon={k.icon}
            label={k.label}
            value={k.value}
            pulse={k.pulse}
            color={k.color}
            index={i}
            active={highlight === k.key}
            onClick={() => onKpiClick(k.key)}
          />
        ))}
      </div>

      {/* RTP 红黄绿看板 */}
      <RtpKanban
        canManage={canManage}
        highlight={highlight}
        state={state}
        onMoveAthlete={moveAthlete}
        onAdjustStage={(athlete, injury) => setStageEdit({ athlete, injury })}
        onAddNote={(athlete) => { setNoteFor(athlete); setNoteText(''); }}
        onMarkReviewed={(athlete) => toast(`已标记 ${athlete.name} 完成复诊（演示）`)}
        onOpenDrawer={setDrawerFor}
      />

      {/* ACWR 预警区 */}
      <div ref={acwrRef} className="mt-6 grid scroll-mt-6 grid-cols-1 gap-5 lg:grid-cols-12">
        <AcwrMatrix onHover={setHoveredAlert} />
        <AcwrAlertList canAct={canAct} hoveredId={hoveredAlert} onHover={setHoveredAlert} />
      </div>

      {/* 负荷趋势对比 */}
      <LoadTrend />

      {/* 运动员健康详情抽屉 */}
      <HealthDrawer
        athlete={drawerFor ? getAthlete(drawerFor) ?? null : null}
        rtpOverride={drawerFor ? state.rtpOverrides[drawerFor] : undefined}
        stageOverrides={state.stageOverrides}
        onClose={() => setDrawerFor(null)}
      />

      {/* 预警规则 Modal */}
      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="预警规则（演示用静态表）" width={480}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-text-3">
              <th className="py-2 font-semibold">规则</th>
              <th className="py-2 font-semibold">阈值</th>
              <th className="py-2 font-semibold">级别</th>
            </tr>
          </thead>
          <tbody>
            {WARNING_RULES.map((r) => (
              <tr key={r.rule} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 text-text-1">{r.rule}</td>
                <td className="py-2.5 font-mono-data text-[13px] tnum">{r.threshold}</td>
                <td className="py-2.5">
                  <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', r.level === 'red' ? 'text-risk' : 'text-warn')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', r.level === 'red' ? 'bg-risk' : 'bg-warn')} />
                    {r.level === 'red' ? '红色预警' : '黄色关注'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      {/* 调整 RTP 阶段 Modal（队医） */}
      <Modal open={!!stageEdit} onClose={() => setStageEdit(null)} title={`调整 RTP 阶段 · ${stageEdit?.athlete.name ?? ''}`} width={440}>
        {stageEdit && (
          <div>
            <p className="text-sm text-text-2">{stageEdit.injury.type} · {stageEdit.injury.site}</p>
            <div className="mt-3 flex flex-col gap-2">
              {RTP_STAGES.map((s, i) => {
                const current = state.stageOverrides[stageEdit.injury.id] ?? stageEdit.injury.rtpStage;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setState((prev) => ({
                        rtpOverrides: i >= 4
                          ? { ...prev.rtpOverrides, [stageEdit.athlete.id]: 'green' }
                          : prev.rtpOverrides,
                        stageOverrides: { ...prev.stageOverrides, [stageEdit.injury.id]: i },
                      }));
                      toast(`已将 ${stageEdit.athlete.name} 调整至 RTP 第 ${i + 1} 阶段（${s}）（演示）`);
                      if (i >= 4) toast(`${stageEdit.athlete.name} 已迁移至「可参训」列（演示）`, 'info');
                      setStageEdit(null);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors',
                      i === current ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-line hover:border-brand-500',
                    )}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full font-mono-data text-xs font-bold text-white"
                      style={{ background: i < current ? '#16A34A' : i === current ? '#2563EB' : '#CBD5E1' }}
                    >
                      {i + 1}
                    </span>
                    {s}
                    {i === current && <span className="ml-auto text-xs font-normal text-brand-600">当前阶段</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* 添加医嘱 Modal（队医） */}
      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`添加医嘱 · ${noteFor?.name ?? ''}`} width={440}>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          placeholder="输入医嘱内容（演示，不会持久化）…"
          className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-brand-500"
        />
        <button
          onClick={() => {
            toast(`已为 ${noteFor?.name} 添加医嘱（演示）`);
            setNoteFor(null);
          }}
          disabled={!noteText.trim()}
          className="mt-3 h-9 w-full rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          提交医嘱
        </button>
      </Modal>
    </div>
  );
}

// ---------- 摘要条 mini KPI ----------

interface MiniKpiProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  pulse: boolean;
  color: string;
  index: number;
  active: boolean;
  onClick: () => void;
}

function MiniKpi({ icon, label, value, pulse, color, index, active, onClick }: MiniKpiProps) {
  const display = useCountUp(value);
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-[14px] border bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift',
        active ? 'border-brand-600 ring-1 ring-brand-500/40' : 'border-line',
      )}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: color + '14' }}>
        {icon}
        {pulse && value > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-risk" />
          </span>
        )}
      </span>
      <span>
        <span className="block text-xs text-text-3">{label}</span>
        <span className="font-mono-data text-xl font-bold leading-6 text-text-1 tnum">{display}</span>
      </span>
    </motion.button>
  );
}
