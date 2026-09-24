/**
 * RtpKanban — RTP 红黄绿三列看板（health-warning.md §3）
 * 队医可拖拽迁移卡片 / 处置下拉；其他角色只读
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ClipboardPlus, Stethoscope, CalendarCheck, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AgeBadge, StatusBadge } from '@/components/common';
import {
  ATHLETES, RTP_LABEL, MONITORING_IDS, injuriesByAthlete,
  type Athlete, type Injury, type RTPStatus,
} from '@/data';
import RtpMiniProgress from './RtpMiniProgress';
import { daysUntil, shortDate } from './healthUtils';

export interface KanbanState {
  rtpOverrides: Record<string, RTPStatus>;
  stageOverrides: Record<string, number>;
}

interface RtpKanbanProps {
  canManage: boolean;
  highlight: 'red' | 'amber' | 'green' | null;
  state: KanbanState;
  onMoveAthlete: (athleteId: string, to: RTPStatus) => void;
  onAdjustStage: (athlete: Athlete, injury: Injury) => void;
  onAddNote: (athlete: Athlete) => void;
  onMarkReviewed: (athlete: Athlete) => void;
  onOpenDrawer: (athleteId: string) => void;
}

const COLUMNS: { key: RTPStatus; title: string; bg: string; dot: string }[] = [
  { key: 'red', title: '停训', bg: 'rgba(220,38,38,0.04)', dot: '#DC2626' },
  { key: 'amber', title: '限制参训', bg: 'rgba(217,119,6,0.04)', dot: '#D97706' },
  { key: 'green', title: '可参训', bg: 'rgba(22,163,74,0.04)', dot: '#16A34A' },
];

function activeInjuryOf(athleteId: string, stageOverrides: Record<string, number>): Injury | undefined {
  const inj = injuriesByAthlete(athleteId).find((i) => i.status === 'active');
  if (!inj) return undefined;
  const s = stageOverrides[inj.id];
  return s === undefined ? inj : { ...inj, rtpStage: s };
}

export default function RtpKanban({
  canManage, highlight, state, onMoveAthlete, onAdjustStage, onAddNote, onMarkReviewed, onOpenDrawer,
}: RtpKanbanProps) {
  const [greenExpanded, setGreenExpanded] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<RTPStatus | null>(null);

  const columns = useMemo(() => {
    const rtpOf = (a: Athlete): RTPStatus => state.rtpOverrides[a.id] ?? a.rtp;
    return {
      red: ATHLETES.filter((a) => rtpOf(a) === 'red'),
      amber: ATHLETES.filter((a) => rtpOf(a) === 'amber'),
      green: ATHLETES.filter((a) => rtpOf(a) === 'green'),
    } as Record<RTPStatus, Athlete[]>;
  }, [state.rtpOverrides]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {COLUMNS.map((col, ci) => {
        const list = columns[col.key];
        const dimmed = highlight !== null && highlight !== col.key;
        return (
          <motion.section
            key={col.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.08, duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'rounded-[14px] border border-line bg-white shadow-card transition-opacity duration-200',
              dimmed && 'opacity-40',
              dragOver === col.key && 'ring-2 ring-brand-500',
            )}
            style={{ background: `linear-gradient(180deg, ${col.bg}, #fff 30%)` }}
            onDragOver={(e: React.DragEvent) => {
              if (!canManage) return;
              e.preventDefault();
              setDragOver(col.key);
            }}
            onDragLeave={() => setDragOver((v) => (v === col.key ? null : v))}
            onDrop={(e: React.DragEvent) => {
              setDragOver(null);
              if (!canManage) return;
              const id = e.dataTransfer.getData('text/athlete-id');
              if (id && (state.rtpOverrides[id] ?? ATHLETES.find((a) => a.id === id)?.rtp) !== col.key) {
                onMoveAthlete(id, col.key);
              }
            }}
          >
            {/* 列头 */}
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.dot }} />
              <h3>{col.title}</h3>
              <span
                className="rounded-full px-1.5 py-px font-mono-data text-[11px] font-semibold tnum"
                style={{ background: col.dot + '1A', color: col.dot }}
              >
                {list.length}
              </span>
              {col.key === 'green' && (
                <button
                  onClick={() => setGreenExpanded((v) => !v)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-brand-600 transition-colors hover:text-brand-700"
                >
                  {greenExpanded ? (
                    <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>展开 <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 p-4">
              {col.key === 'green' && !greenExpanded ? (
                /* 绿列默认折叠：头像墙 */
                <button
                  onClick={() => setGreenExpanded(true)}
                  className="rounded-xl border border-dashed border-line p-4 text-left transition-colors hover:border-ok/40 hover:bg-ok-bg/40"
                >
                  <div className="flex flex-wrap gap-2">
                    {list.map((a) => (
                      <span key={a.id} className="relative" title={a.name}>
                        <Avatar name={a.name} group={a.group} size={34} />
                        {MONITORING_IDS.includes(a.id) && (
                          <span className="absolute -right-1 -top-1 rounded-full bg-[#8B5CF6] px-1 text-[9px] font-semibold leading-[14px] text-white">
                            监控
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-text-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                    全部状态正常 · 点击展开完整卡片
                  </p>
                </button>
              ) : (
                list.map((a, i) => (
                  <AthleteCard
                    key={a.id}
                    athlete={a}
                    injury={activeInjuryOf(a.id, state.stageOverrides)}
                    index={i}
                    canManage={canManage}
                    menuOpen={menuFor === a.id}
                    onToggleMenu={() => setMenuFor((v) => (v === a.id ? null : a.id))}
                    onCloseMenu={() => setMenuFor(null)}
                    onAdjustStage={() => {
                      const inj = activeInjuryOf(a.id, state.stageOverrides);
                      if (inj) onAdjustStage(a, inj);
                    }}
                    onAddNote={() => onAddNote(a)}
                    onMarkReviewed={() => onMarkReviewed(a)}
                    onOpenDrawer={() => onOpenDrawer(a.id)}
                  />
                ))
              )}
              {list.length === 0 && (
                <p className="py-6 text-center text-xs text-text-3">暂无运动员</p>
              )}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

// ---------- 运动员卡片 ----------

interface AthleteCardProps {
  athlete: Athlete;
  injury?: Injury;
  index: number;
  canManage: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onAdjustStage: () => void;
  onAddNote: () => void;
  onMarkReviewed: () => void;
  onOpenDrawer: () => void;
}

function AthleteCard({
  athlete: a, injury, index, canManage, menuOpen,
  onToggleMenu, onCloseMenu, onAdjustStage, onAddNote, onMarkReviewed, onOpenDrawer,
}: AthleteCardProps) {
  const monitoring = MONITORING_IDS.includes(a.id);
  const remain = injury ? daysUntil(injury.estReturn) : null;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.25 }}
      className={cn(
        'relative rounded-xl border border-line bg-white p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lift',
        canManage && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div
        draggable={canManage}
        onDragStart={(e) => e.dataTransfer.setData('text/athlete-id', a.id)}
        className="flex items-start gap-2.5"
      >
        <Avatar name={a.name} group={a.group} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button onClick={onOpenDrawer} className="truncate text-sm font-semibold text-text-1 hover:text-brand-600">
              {a.name}
            </button>
            <AgeBadge group={a.group} />
            <span className="text-xs text-text-3">{a.position}</span>
          </div>
          {injury ? (
            <p className="mt-0.5 truncate text-xs text-text-2" title={injury.type}>
              {injury.type} · {injury.site}
            </p>
          ) : a.acwr !== null && a.acwr > 1.3 ? (
            <p className="mt-0.5 text-xs text-text-2">
              ACWR <span className="font-mono-data font-semibold text-risk tnum">{a.acwr.toFixed(2)}</span> 超限 · 负荷调整中
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-text-3">
              {monitoring ? '发育期骨骺炎 · 带伤监控' : '状态正常'} · ACWR {a.acwr?.toFixed(2) ?? '—'}
            </p>
          )}
        </div>
        <StatusBadge tone={a.rtp === 'red' ? 'red' : a.rtp === 'amber' ? 'amber' : 'green'} label={RTP_LABEL[a.rtp]} pulse={false} className="shrink-0" />
      </div>

      {injury && (
        <>
          <RtpMiniProgress stage={injury.rtpStage} className="mt-2.5" />
          <p className="mt-2 text-xs text-text-3">
            预计复出 <span className="font-mono-data font-medium text-text-1 tnum">{shortDate(injury.estReturn)}</span>
            {remain !== null && remain >= 0 && <> · 剩余 <span className="font-mono-data tnum">{remain}</span> 天</>}
            {' '}· {injury.doctor}
          </p>
        </>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
        <button
          onClick={onOpenDrawer}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <Eye className="h-3.5 w-3.5" /> 查看康复时间线 →
        </button>
        <span className="flex items-center gap-1.5">
          {monitoring && (
            <span className="rounded-full bg-[#8B5CF6]/10 px-1.5 py-px text-[10px] font-semibold text-[#8B5CF6]">监控</span>
          )}
          {injury && (
            <Link
              to={`/medical?injury=${injury.id}`}
              className="text-[11px] text-text-3 transition-colors hover:text-brand-600"
            >
              伤病详情 →
            </Link>
          )}
        </span>
      </div>

      {/* 队医专属：处置下拉 */}
      {canManage && (
        <div className="absolute right-2.5 top-2.5">
          <button
            onClick={onToggleMenu}
            className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-medium text-text-2 shadow-card transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            处置 <ChevronDown className="h-3 w-3" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={onCloseMenu} />
              <div className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lift">
                <MenuItem icon={<Stethoscope className="h-3.5 w-3.5" />} label="调整RTP阶段" disabled={!injury}
                  onClick={() => { onCloseMenu(); onAdjustStage(); }} />
                <MenuItem icon={<ClipboardPlus className="h-3.5 w-3.5" />} label="添加医嘱"
                  onClick={() => { onCloseMenu(); onAddNote(); }} />
                <MenuItem icon={<CalendarCheck className="h-3.5 w-3.5" />} label="标记已复诊"
                  onClick={() => { onCloseMenu(); onMarkReviewed(); }} />
              </div>
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-1 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
      {disabled && <span className="ml-auto text-[10px] text-text-3">无活跃伤病</span>}
    </button>
  );
}

/** 供页面统计使用 */
export function kanbanCounts(state: KanbanState): Record<RTPStatus, number> {
  const rtpOf = (a: Athlete): RTPStatus => state.rtpOverrides[a.id] ?? a.rtp;
  return {
    red: ATHLETES.filter((a) => rtpOf(a) === 'red').length,
    amber: ATHLETES.filter((a) => rtpOf(a) === 'amber').length,
    green: ATHLETES.filter((a) => rtpOf(a) === 'green').length,
  };
}

/** 供页面判断"是否被移动到绿列" */
export function rtpOfAthlete(state: KanbanState, a: Athlete): RTPStatus {
  return state.rtpOverrides[a.id] ?? a.rtp;
}
