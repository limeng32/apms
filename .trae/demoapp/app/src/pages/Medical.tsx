/**
 * /medical 医疗康复中心 — 伤病台账 · EMR/影像归档 · RTP 时间线（medical.md）
 * RBAC：doctor 全部操作；coach/fitness 脱敏台账；analyst 仅统计区
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CalendarClock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal, EmptyState, ProgressRing, useToast, useCountUp } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import {
  INJURIES, RTP_STAGES, injuryStats, activeInjuries, getAthlete, getInjury,
} from '@/data';
import InjuryTable from '@/components/medical/InjuryTable';
import BodyMap from '@/components/medical/BodyMap';
import InjuryDrawer from '@/components/medical/InjuryDrawer';
import LoadLinkage from '@/components/medical/LoadLinkage';
import { daysUntil, shortDate } from '@/components/health/healthUtils';

export default function Medical() {
  const { role, roleInfo } = useRole();
  const { toast } = useToast();
  const isDoctor = role === 'doctor';
  const masked = !isDoctor; // coach / fitness / analyst 均脱敏（analyst 另隐藏台账）
  const showLedger = role !== 'analyst';

  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, number>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  // 从 /health 卡片深链打开指定伤病详情
  useEffect(() => {
    const inj = params.get('injury');
    if (inj && getInjury(inj)) {
      setDrawerFor(inj);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const stats = useMemo(() => injuryStats(), []);
  /** 本月新发（2025-06 起伤发） */
  const newThisMonth = useMemo(() => INJURIES.filter((i) => i.date >= '2025-06-01').length, []);
  /** 平均康复进度 = 活跃记录 RTP 阶段均值 / 4 */
  const avgProgress = useMemo(() => {
    const act = activeInjuries();
    return Math.round((act.reduce((s, i) => s + (stageOverrides[i.id] ?? i.rtpStage), 0) / act.length / 4) * 1000) / 10;
  }, [stageOverrides]);
  /** 预计本周复出（estReturn 在 6.16–6.22） */
  const returnThisWeek = useMemo(
    () => INJURIES.filter((i) => i.status === 'active' && i.estReturn >= '2025-06-16' && i.estReturn <= '2025-06-22'),
    [],
  );
  /** 复诊提醒（未来 7 天内预计复出） */
  const upcoming = useMemo(
    () => INJURIES.filter((i) => i.status === 'active' && i.estReturn >= '2025-06-16' && i.estReturn <= '2025-06-23')
      .sort((a, b) => (a.estReturn < b.estReturn ? -1 : 1)),
    [],
  );

  const drawerInjury = drawerFor ? getInjury(drawerFor) ?? null : null;
  const drawerStage = drawerInjury ? stageOverrides[drawerInjury.id] ?? drawerInjury.rtpStage : 0;

  return (
    <div>
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>医疗康复中心</h1>
          <p className="mt-1 text-sm text-text-2">
            伤病台账 {INJURIES.length} 例 · 活跃 {stats.active} 例 · 本周复诊 {upcoming.length} 人
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 复诊提醒 */}
          <div className="relative">
            <button
              onClick={() => setReviewOpen((v) => !v)}
              className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-text-2 shadow-card transition-colors hover:border-brand-500 hover:text-brand-600"
            >
              <Bell className="h-4 w-4" /> 复诊提醒
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 font-mono-data text-[10px] font-bold text-white">
                {upcoming.length}
              </span>
            </button>
            {reviewOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setReviewOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-lift">
                  <p className="px-2 py-1.5 text-xs font-semibold text-text-3">近 7 天预计复出 / 复诊</p>
                  {upcoming.map((i) => {
                    const a = getAthlete(i.athleteId);
                    return (
                      <button
                        key={i.id}
                        onClick={() => { setReviewOpen(false); setDrawerFor(i.id); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-canvas"
                      >
                        <CalendarClock className="h-4 w-4 shrink-0 text-warn" />
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-text-1">{a?.name} · {i.type}</span>
                          <span className="block text-xs text-text-3">
                            预计 <span className="font-mono-data tnum">{shortDate(i.estReturn)}</span>
                            （{daysUntil(i.estReturn) === 0 ? '今天' : `${daysUntil(i.estReturn)} 天后`}）
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            disabled={!isDoctor}
            title={isDoctor ? undefined : `当前角色（${roleInfo.name}）无新增权限`}
            onClick={() => setNewOpen(true)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all',
              isDoctor
                ? 'bg-btn-brand text-white hover:bg-btn-brand-hover active:scale-[0.97]'
                : 'cursor-not-allowed bg-canvas text-text-3',
            )}
          >
            <Plus className="h-4 w-4" /> 新增伤病记录
          </button>
        </div>
      </div>

      {/* KPI 带 */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MedKpi index={0} label="活跃伤病" value={stats.active} color="#D97706" hint={`停训 ${stats.stopped} · 限制 ${stats.limited} · 监控 ${stats.monitoring}`} />
        <MedKpi index={1} label="本月新发" value={newThisMonth} color="#DC2626" pulse hint="2025-06 起伤发" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
          className="flex items-center justify-between rounded-[14px] border border-line bg-white p-4 shadow-card"
        >
          <div>
            <p className="text-xs text-text-3">平均康复进度</p>
            <p className="mt-1 text-xs text-text-3">活跃 {stats.active} 例 RTP 阶段均值</p>
          </div>
          <ProgressRing value={avgProgress} size={72} stroke={7} tone="blue" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
          className="rounded-[14px] border border-line bg-white p-4 shadow-card"
        >
          <p className="text-xs text-text-3">预计本周复出</p>
          <p className="mt-1 font-mono-data text-[30px] font-bold leading-[38px] text-ok tnum">{returnThisWeek.length}</p>
          <p className="text-xs text-text-3">
            {returnThisWeek.map((i) => `${getAthlete(i.athleteId)?.name} ${shortDate(i.estReturn)}`).join(' · ') || '无'}
          </p>
        </motion.div>
      </div>

      {/* 主区：台账 + 人体分布 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {showLedger ? (
          <InjuryTable masked={masked} stageOverrides={stageOverrides} onOpen={(inj) => setDrawerFor(inj.id)} />
        ) : (
          <div className="rounded-[14px] border border-line bg-white shadow-card lg:col-span-8">
            <EmptyState title="当前角色无台账权限" desc={`角色：${roleInfo.name} · 可查看上方统计区与伤病部位分布`} />
          </div>
        )}
        <BodyMap />
      </div>

      {/* 康复负荷联动 */}
      <LoadLinkage />

      {/* 伤病详情抽屉 */}
      <InjuryDrawer
        injury={drawerInjury}
        stage={drawerStage}
        masked={masked}
        onClose={() => setDrawerFor(null)}
        onAdvanceStage={(injury, next) => {
          setStageOverrides((prev) => ({ ...prev, [injury.id]: next }));
          toast(`已推进至${RTP_STAGES[next]}阶段（演示）`);
        }}
      />

      {/* 新增伤病记录 Modal（队医演示表单） */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="新增伤病记录（演示）" width={480}>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs text-text-2">运动员</span>
            <select className="h-9 w-full rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-brand-500">
              <option value="">选择运动员…</option>
              {Array.from(new Set(INJURIES.map((i) => i.athleteId))).map((id) => {
                const a = getAthlete(id);
                return <option key={id} value={id}>{a?.name} · {a?.group}</option>;
              })}
            </select>
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs text-text-2">诊断</span>
            <input placeholder="如：股二头肌 I 级拉伤" className="h-9 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-text-2">部位</span>
            <input placeholder="如：右大腿后侧" className="h-9 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-text-2">程度</span>
            <select className="h-9 w-full rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-brand-500">
              <option>轻</option>
              <option>中</option>
              <option>重</option>
            </select>
          </label>
        </div>
        <button
          onClick={() => { toast('伤病记录已创建（演示）'); setNewOpen(false); }}
          className="mt-4 h-9 w-full rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
        >
          创建记录
        </button>
      </Modal>
    </div>
  );
}

// ---------- KPI（带脉冲红点） ----------

function MedKpi({ index, label, value, color, hint, pulse }: { index: number; label: string; value: number; color: string; hint: string; pulse?: boolean }) {
  const display = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[14px] border border-line bg-white p-4 shadow-card"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <p className="flex items-center gap-1.5 text-xs text-text-3">
        {label}
        {pulse && value > 0 && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-risk" />
          </span>
        )}
      </p>
      <p className="mt-1 font-mono-data text-[30px] font-bold leading-[38px] text-text-1 tnum">{display}</p>
      <p className="text-xs text-text-3">{hint}</p>
    </motion.div>
  );
}
