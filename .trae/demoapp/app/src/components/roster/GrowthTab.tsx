/**
 * GrowthTab — 档案 Tab2「体态与成长」（roster.md §B Tab2）
 * 基础体态定义列表 / 身高成长曲线（PHV 标注）/ 发育评估条
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Ruler, Cpu, Target } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, useToast } from '@/components/common';
import { DEMO_TODAY, MATURITY_LABEL, maturityBand } from '@/data';
import type { Athlete } from '@/data';
import { cn } from '@/lib/utils';
import { DarkTooltip, TooltipRow } from './chartTheme';
import { AXIS_TICK, GRID_STROKE } from './chartConsts';
import { growthSeries, seededRandom } from './utils';

function Delta({ value, unit, goodWhenUp = true }: { value: number; unit: string; goodWhenUp?: boolean }) {
  if (value === 0) return <span className="font-mono-data text-[11px] text-text-3">±0{unit}</span>;
  const good = value > 0 === goodWhenUp;
  return (
    <span className={cn('inline-flex items-center font-mono-data text-[11px]', good ? 'text-ok' : 'text-warn')}>
      {value > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {value > 0 ? '+' : ''}
      {value}
      {unit}
    </span>
  );
}

export default function GrowthTab({ athlete }: { athlete: Athlete }) {
  const { toast } = useToast();
  const series = useMemo(() => growthSeries(athlete), [athlete]);
  const phvPoint = series.find((p) => p.isPhv);

  // 基础体态：当前真实字段 + 由成长序列/种子派生的环比 delta
  const bodyRows = useMemo(() => {
    const rand = seededRandom(`${athlete.id}-body`);
    const hDelta = Math.round((series[series.length - 1].height - series[series.length - 2].height) * 10) / 10;
    const wDelta = Math.round((series[series.length - 1].weight - series[series.length - 2].weight) * 10) / 10;
    const bmi = Math.round((athlete.weight / Math.pow(athlete.height / 100, 2)) * 10) / 10;
    const armSpan = athlete.height + Math.round(2 + rand() * 4); // 臂展（派生）
    return [
      { label: '身高', value: `${athlete.height} cm`, delta: <Delta value={hDelta} unit="cm" /> },
      { label: '体重', value: `${athlete.weight} kg`, delta: <Delta value={wDelta} unit="kg" /> },
      { label: '坐高', value: `${athlete.sittingHeight} cm`, delta: <Delta value={Math.round(hDelta * 0.55 * 10) / 10} unit="cm" /> },
      { label: 'BMI', value: String(bmi), delta: <Delta value={Math.round((rand() - 0.4) * 6) / 10} unit="" /> },
      { label: '臂展', value: `${armSpan} cm`, delta: <Delta value={Math.round(hDelta * 10) / 10} unit="cm" /> },
      { label: '体脂率', value: `${athlete.bodyFat} %`, delta: <Delta value={Math.round((rand() - 0.55) * 8) / 10} unit="%" goodWhenUp={false} /> },
    ];
  }, [athlete, series]);

  const pctOfPredicted = Math.round((athlete.height / athlete.predictedHeight) * 1000) / 10;
  const ageYears = useMemo(() => {
    const [by, bm, bd] = athlete.birth.split('-').map(Number);
    const [ty, tm, td] = DEMO_TODAY.split('-').map(Number);
    return Math.round(((ty - by) + (tm - bm) / 12 + (td - bd) / 365) * 10) / 10;
  }, [athlete.birth]);
  const legLength = athlete.height - athlete.sittingHeight; // 下肢长（派生）
  const midParental = Math.round(((athlete.fatherHeight + athlete.motherHeight) / 2) * 10) / 10;
  const band = maturityBand(athlete);

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* 基础体态 */}
      <ChartCard
        title="基础体态"
        subtitle="较上次测量（月度形态采集）"
        className="col-span-12 lg:col-span-4"
        actions={
          <button
            onClick={() => toast('测量更新表单（演示环境暂不支持）', 'info')}
            className="h-8 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition-colors hover:bg-canvas"
          >
            更新测量
          </button>
        }
      >
        <dl className="divide-y divide-line">
          {bodyRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5">
              <dt className="text-sm text-text-3">{r.label}</dt>
              <dd className="flex items-center gap-3">
                <span className="text-cell-num font-semibold text-text-1 tnum">{r.value}</span>
                {r.delta}
              </dd>
            </div>
          ))}
        </dl>
      </ChartCard>

      {/* 身高成长曲线 */}
      <ChartCard
        title="身高成长曲线 · 近 3 年"
        subtitle={`PHV 预测点 ${athlete.phvAge} 岁（紫色标记）`}
        className="col-span-12 lg:col-span-8"
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis yAxisId="h" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={['dataMin - 4', 'dataMax + 4']} />
            <YAxis yAxisId="w" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} domain={['dataMin - 3', 'dataMax + 3']} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <DarkTooltip title={`${String(label)} · ${series.find((s) => s.date === label)?.age ?? ''} 岁`}>
                {payload.map((p) => (
                  <TooltipRow key={String(p.dataKey)} color={String(p.color)} name={String(p.name)} value={`${p.value}${p.dataKey === 'height' ? 'cm' : 'kg'}`} />
                ))}
              </DarkTooltip>
            ) : null} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
            <Area yAxisId="h" name="身高 (cm)" type="monotone" dataKey="height" stroke="#3B82F6" strokeWidth={2.5} fill="#3B82F6" fillOpacity={0.12} dot={{ r: 3 }} />
            <Area yAxisId="w" name="体重 (kg)" type="monotone" dataKey="weight" stroke="#06B6D4" strokeWidth={2} fill="#06B6D4" fillOpacity={0.08} dot={{ r: 3 }} />
            {phvPoint && (
              <ReferenceDot yAxisId="h" x={phvPoint.date} y={phvPoint.height} r={6} fill="#8B5CF6" stroke="#fff" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
        {phvPoint && (
          <p className="mt-1 text-center text-xs text-violet-500">
            ● PHV {athlete.phvAge} 岁 · 约 {phvPoint.date}（峰值身高速度窗口）
          </p>
        )}
      </ChartCard>

      {/* 发育评估条（通栏） */}
      <ChartCard title="发育评估" subtitle="当前身高占预测成年身高比例 · PHV 窗口 90%–96%" className="col-span-12">
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-[288px] flex-1">
            <div className="relative h-4 w-full overflow-visible rounded-full bg-[#EEF2F7]">
              {/* PHV 窗口刻度区 */}
              <div className="absolute inset-y-0 rounded-full bg-violet-500/15" style={{ left: '90%', width: '6%' }} />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pctOfPredicted)}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-600 to-cyan-500"
              />
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 20 }}
                className="absolute -top-1 h-6 w-1.5 rounded-full bg-text-1"
                style={{ left: `calc(${Math.min(100, pctOfPredicted)}% - 3px)` }}
              />
            </div>
            <div className="relative mt-1.5 h-4 text-[10px] text-text-3">
              <span className="absolute left-0">0%</span>
              <span className="absolute text-violet-500" style={{ left: '88%' }}>PHV 窗口 90–96%</span>
              <span className="absolute right-0">100%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono-data text-2xl font-bold text-text-1 tnum">{pctOfPredicted}%</span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium',
                band === 'onTime' && 'border-[#B7E4C7] bg-ok-bg text-ok',
                band === 'early' && 'border-[#BFDBFE] bg-brand-50 text-brand-600',
                band === 'late' && 'border-[#F5D9A8] bg-warn-bg text-warn',
              )}
            >
              成熟度偏移 {athlete.maturityOffset > 0 ? '+' : ''}
              {athlete.maturityOffset} 岁 · {MATURITY_LABEL[band]}
            </span>
            <Link to="/development" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              查看青训发育监控
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </ChartCard>

      {/* 生长发育评估（PHV 无创生物学成熟度模型） */}
      <ChartCard
        title="生长发育评估 · 无创生物学成熟度模型"
        subtitle="基础测量数据 → 内置算法 → 预测成年身高与 PHV（演示数据）"
        className="col-span-12"
      >
        <div className="grid grid-cols-12 gap-5">
          {/* 输入：基础测量数据 */}
          <div className="col-span-12 lg:col-span-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-1">
              <Ruler className="h-4 w-4 text-brand-600" />
              输入 · 基础测量数据
            </div>
            <dl className="divide-y divide-line rounded-xl border border-line bg-canvas px-4">
              {[
                { k: '年龄', v: `${ageYears} 岁`, s: athlete.birth },
                { k: '站立身高', v: `${athlete.height} cm`, s: '月度形态采集' },
                { k: '坐高', v: `${athlete.sittingHeight} cm`, s: `下肢长 ${legLength} cm` },
                { k: '体重', v: `${athlete.weight} kg`, s: `体脂率 ${athlete.bodyFat}%` },
                { k: '父亲身高', v: `${athlete.fatherHeight} cm`, s: '家长问卷' },
                { k: '母亲身高', v: `${athlete.motherHeight} cm`, s: `中亲身高 ${midParental} cm` },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between py-2">
                  <dt className="text-sm text-text-3">{r.k}</dt>
                  <dd className="text-right">
                    <span className="text-cell-num font-semibold text-text-1 tnum">{r.v}</span>
                    <span className="block text-[10px] text-text-3">{r.s}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 算法引擎 */}
          <div className="col-span-12 flex flex-col justify-center gap-3 lg:col-span-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-1">
              <Cpu className="h-4 w-4 text-violet-500" />
              内置算法引擎
            </div>
            {[
              { name: 'Khamis-Roche 模型', desc: '无需骨龄片，以身高/体重/坐高与中亲身高回归预测成年身高', tag: '身高预测' },
              { name: 'Mirwald 成熟度偏移', desc: '由年龄、坐高、下肢长推算距 PHV 的时间（岁）', tag: '成熟度' },
              { name: 'PHV 窗口判定', desc: '|偏移| ≤ 1 岁进入敏感期，联动降负荷与选材建议', tag: '窗口' },
            ].map((m) => (
              <div key={m.name} className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-1">{m.name}</span>
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600">{m.tag}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-3">{m.desc}</p>
              </div>
            ))}
          </div>

          {/* 输出：预测结果 */}
          <div className="col-span-12 lg:col-span-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-1">
              <Target className="h-4 w-4 text-ok" />
              输出 · 预测与判定
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="text-xs text-text-3">预测成年最终身高</p>
                <p className="mt-1 font-mono-data text-3xl font-bold text-text-1 tnum">
                  {athlete.predictedHeight}
                  <span className="ml-1 text-sm font-normal text-text-3">cm</span>
                </p>
                <p className="mt-1 text-[11px] text-text-3">当前 {athlete.height} cm · 占预测 {pctOfPredicted}%</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="text-xs text-text-3">预测 PHV 发生年龄</p>
                <p className="mt-1 font-mono-data text-3xl font-bold text-violet-600 tnum">
                  {athlete.phvAge}
                  <span className="ml-1 text-sm font-normal text-text-3">岁</span>
                </p>
                <p className="mt-1 text-[11px] text-text-3">最大身高速度发生期</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="text-xs text-text-3">成熟度偏移</p>
                <p className="mt-1 font-mono-data text-3xl font-bold text-text-1 tnum">
                  {athlete.maturityOffset > 0 ? '+' : ''}
                  {athlete.maturityOffset}
                  <span className="ml-1 text-sm font-normal text-text-3">岁</span>
                </p>
                <p className="mt-1 text-[11px] text-text-3">当前年龄 − 预测 PHV 年龄</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="text-xs text-text-3">成熟度判定</p>
                <p
                  className={cn(
                    'mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold',
                    band === 'onTime' && 'border-[#B7E4C7] bg-ok-bg text-ok',
                    band === 'early' && 'border-[#BFDBFE] bg-brand-50 text-brand-600',
                    band === 'late' && 'border-[#F5D9A8] bg-warn-bg text-warn',
                  )}
                >
                  {MATURITY_LABEL[band]}
                </p>
                <p className="mt-2 text-[11px] text-text-3">
                  {Math.abs(athlete.maturityOffset) <= 1 ? '处于 PHV ±1 年敏感窗口' : '不在 PHV 敏感窗口'}
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[11px] leading-relaxed text-text-3">
              无创模型仅基于常规体测与家长问卷，无需 X 光骨龄片；每次月度形态采集后自动重算，结果同步至青训发育监控与选材报告。
            </p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
