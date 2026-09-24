/**
 * Dashboard — 数据总览驾驶舱 `/`（dashboard.md）
 * 5 KPI 卡（count-up）· RTP 三色 Donut/堆叠条 · 本周测试任务进度 · 伤病摘要 ·
 * PHV 分布 · ACWR 预警 · 12 周负荷组合图 · 实时动态 · 大屏模式深色变体 · 角色差异
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange, ChevronDown, Moon, Sun } from 'lucide-react';
import { useToast } from '@/components/common';
import {
  ATHLETES,
  TEAM_ACWR,
  activeInjuries,
  injuryStats,
  rtpSummary,
  taskSummary,
} from '@/data';
import { DEMO_WEEK } from '@/data';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import DashKpiCard from '@/components/dashboard/DashKpiCard';
import RtpCard from '@/components/dashboard/RtpCard';
import TasksCard from '@/components/dashboard/TasksCard';
import InjuryCard from '@/components/dashboard/InjuryCard';
import PhvCard from '@/components/dashboard/PhvCard';
import AcwrCard from '@/components/dashboard/AcwrCard';
import TeamLoadCard from '@/components/dashboard/TeamLoadCard';
import ActivityCard from '@/components/dashboard/ActivityCard';
import RtpGanttMini from '@/components/dashboard/RtpGanttMini';

type RangeKey = 'week' | 'month' | 'term';
const RANGE_LABEL: Record<RangeKey, string> = { week: '本周', month: '本月', term: '本学期' };

const rowVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

/** 大屏模式每秒刷新的时钟（Mono） */
function useClock(enabled: boolean): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now.toLocaleTimeString('zh-CN', { hour12: false });
}

export default function Dashboard() {
  const { role } = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [big, setBig] = useState(false);
  const [range, setRange] = useState<RangeKey>('week');
  const [rangeOpen, setRangeOpen] = useState(false);
  /** 演示用时间范围数字微调系数（±5%） */
  const [factor, setFactor] = useState(1);
  const clock = useClock(big);

  // ---- 数据汇总（全部来自 @/data） ----
  const rtp = rtpSummary();
  const injuries = injuryStats();
  const tasks = taskSummary();
  const teamAcwrNow = TEAM_ACWR[TEAM_ACWR.length - 1].acwr;

  // 队医视角 KPI 派生
  const doctorKpi = useMemo(() => {
    const act = activeInjuries();
    const newThisMonth = act.filter(
      (i) => i.date >= '2025-06-01' && (i.activeKind === '停训' || i.activeKind === '限制'),
    ).length;
    const avgProgress = Math.floor((act.reduce((s, i) => s + i.rtpStage, 0) / (act.length * 4)) * 100);
    const dueSoon = act.filter((i) => i.estReturn <= '2025-06-23').length;
    return { active: act.length, newThisMonth, avgProgress, dueSoon };
  }, []);

  const switchRange = (r: RangeKey) => {
    setRange(r);
    setRangeOpen(false);
    // 演示用数字微调（±5% 内确定性系数，避免渲染期随机数）
    setFactor(r === 'month' ? 1.04 : r === 'term' ? 0.96 : 1);
    toast(`已切换至${RANGE_LABEL[r]}视图（演示）`, 'info');
  };

  const pct = Math.min(100, Math.round(tasks.weeklyRate * factor));

  const kpis =
    role === 'doctor'
      ? [
          { title: '活跃伤病', value: doctorKpi.active, unit: '例', accent: '#D97706', chip: '处置中', chipTone: 'up-warn' as const },
          { title: '本周新增', value: doctorKpi.newThisMonth, unit: '例', accent: '#DC2626', chip: '需跟进', chipTone: 'flat' as const },
          { title: 'RTP 进行中', value: doctorKpi.active, unit: '例', accent: '#2563EB', chip: '五阶段流程', chipTone: 'info' as const },
          { title: '平均康复进度', value: doctorKpi.avgProgress, unit: '%', accent: '#16A34A', chip: '+5% 本周', chipTone: 'up-good' as const },
          { title: '待复诊', value: doctorKpi.dueSoon, unit: '人', accent: '#8B5CF6', chip: '临近复出窗口', chipTone: 'flat' as const },
        ]
      : [
          { title: '在训运动员', value: ATHLETES.length, unit: '人', accent: '#2563EB', chip: '+2 本学期', chipTone: 'info' as const },
          {
            title: '本周测试完成率',
            value: pct,
            unit: '%',
            accent: '#06B6D4',
            chip: '+8%',
            chipTone: 'up-good' as const,
            spark: [45, 52, 58, 60, 63, 65, 70, pct],
            sparkColor: '#06B6D4',
          },
          {
            title: '活跃伤病',
            value: injuries.active,
            unit: '例',
            accent: '#D97706',
            chip: '-1',
            chipTone: 'down-good' as const,
            spark: [6, 7, 7, 8, 9, 9, 9, injuries.active],
            sparkColor: '#D97706',
          },
          {
            title: '红色预警',
            value: rtp.red,
            unit: '人',
            accent: '#DC2626',
            chip: '持平',
            chipTone: 'flat' as const,
            spark: [1, 1, 2, 2, 3, 3, 2, rtp.red],
            sparkColor: '#DC2626',
            pulseDot: true,
            onClick: () => navigate('/health?rtp=red'),
          },
          {
            title: '全队平均 ACWR',
            value: Math.round(teamAcwrNow * factor * 100) / 100,
            decimals: 2,
            accent: '#8B5CF6',
            chip: '+0.06',
            chipTone: 'up-warn' as const,
            spark: [0.98, 1.02, 1.05, 1.01, 1.1, 1.12, 1.04, Math.round(teamAcwrNow * factor * 100) / 100],
            sparkColor: '#8B5CF6',
          },
        ];

  return (
    <div
      className={cn(
        'relative -m-6 min-h-[calc(100dvh-64px)] p-6 transition-colors duration-300',
        big ? 'bg-ink-950' : '',
      )}
    >
      {/* 大屏模式球场线纹理 3% 平铺 */}
      {big && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "url('/pitch-lines.svg')", backgroundSize: 480 }}
        />
      )}

      {/* 标题行 */}
      <div className="relative mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div>
          <h1 className={cn(big && 'text-white')}>数据总览驾驶舱</h1>
          {big && (
            <p className="mt-1 text-xs text-white/50">青训中心 · 数据指挥屏</p>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {big && (
            <span className="font-mono-data text-lg font-semibold text-cyan-400 tnum">{clock}</span>
          )}
          <span className={cn('text-xs', big ? 'text-white/40' : 'text-text-3')}>数据更新于 10 分钟前</span>

          {/* 时间范围下拉（演示） */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                big
                  ? 'border-ink-700 bg-ink-800 text-white/80 hover:bg-white/5'
                  : 'border-line bg-white text-text-2 hover:bg-slate-50',
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              时间范围：{RANGE_LABEL[range]}
              <ChevronDown className={cn('h-3 w-3 transition-transform', rangeOpen && 'rotate-180')} />
            </button>
            {rangeOpen && (
              <>
                <span className="fixed inset-0 z-10" onClick={() => setRangeOpen(false)} />
                <div
                  className={cn(
                    'absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-xl border py-1 shadow-lift',
                    big ? 'border-ink-700 bg-ink-800' : 'border-line bg-white',
                  )}
                >
                  {(Object.keys(RANGE_LABEL) as RangeKey[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => switchRange(r)}
                      className={cn(
                        'block w-full px-3 py-1.5 text-left text-xs transition-colors',
                        r === range
                          ? 'font-semibold text-brand-500'
                          : big
                            ? 'text-white/70 hover:bg-white/5'
                            : 'text-text-2 hover:bg-slate-50',
                      )}
                    >
                      {RANGE_LABEL[r]}
                      {r === 'week' && <span className={cn('ml-1', big ? 'text-white/30' : 'text-text-3')}>{DEMO_WEEK}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 大屏模式开关 */}
          <button
            onClick={() => setBig((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-150 active:scale-95',
              big
                ? 'border-brand-500/40 bg-brand-600/20 text-cyan-300 shadow-glowBlue'
                : 'border-line bg-white text-text-2 hover:bg-slate-50',
            )}
          >
            {big ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {big ? '退出大屏' : '大屏模式'}
          </button>
        </div>
      </div>

      {/* 内容（大屏切换 300ms 交叉淡化） */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={big ? 'big' : 'normal'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative flex flex-col gap-5"
        >
          {/* 行 1：KPI 卡片带 */}
          <motion.div
            variants={rowVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5"
          >
            {kpis.map((k) => (
              <motion.div key={k.title} variants={itemVariants}>
                <DashKpiCard
                  title={k.title}
                  value={k.value}
                  unit={k.unit}
                  decimals={'decimals' in k ? k.decimals : 0}
                  accent={k.accent}
                  chip={k.chip}
                  chipTone={k.chipTone}
                  spark={'spark' in k ? k.spark : undefined}
                  sparkColor={'sparkColor' in k ? k.sparkColor : undefined}
                  pulseDot={'pulseDot' in k ? k.pulseDot : undefined}
                  onClick={'onClick' in k ? k.onClick : undefined}
                  big={big}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* 行 2：RTP 分布（doctor=康复甘特） + 本周测试任务 */}
          <motion.div
            variants={rowVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-5 xl:grid-cols-12"
          >
            <motion.div variants={itemVariants} className="xl:col-span-5">
              {role === 'doctor' ? <RtpGanttMini big={big} /> : <RtpCard big={big} />}
            </motion.div>
            <motion.div variants={itemVariants} className="xl:col-span-7">
              <TasksCard big={big} />
            </motion.div>
          </motion.div>

          {/* 行 3：伤病摘要 + PHV 分布 + ACWR 预警（doctor 视角伤病全宽） */}
          <motion.div
            variants={rowVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-5 xl:grid-cols-12"
          >
            <motion.div variants={itemVariants} className={cn(role === 'doctor' ? 'xl:col-span-12' : 'xl:col-span-4')}>
              <InjuryCard big={big} />
            </motion.div>
            <motion.div variants={itemVariants} className={cn(role === 'doctor' ? 'xl:col-span-6' : 'xl:col-span-4')}>
              <PhvCard big={big} />
            </motion.div>
            <motion.div variants={itemVariants} className={cn(role === 'doctor' ? 'xl:col-span-6' : 'xl:col-span-4')}>
              <AcwrCard big={big} />
            </motion.div>
          </motion.div>

          {/* 行 4：全队负荷与 ACWR 趋势 + 实时动态 */}
          <motion.div
            variants={rowVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-5 xl:grid-cols-12"
          >
            <motion.div variants={itemVariants} className="xl:col-span-8">
              <TeamLoadCard big={big} />
            </motion.div>
            <motion.div variants={itemVariants} className="xl:col-span-4">
              <ActivityCard big={big} />
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
