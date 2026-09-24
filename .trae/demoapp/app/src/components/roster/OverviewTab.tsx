/**
 * OverviewTab — 档案 Tab1「概览」（roster.md §B Tab1）
 * 六维雷达 / 近期状态卡 / 最近成绩速览 / 成长速览双系列组合图
 */

import { useMemo } from 'react';
import {
  CartesianGrid, ComposedChart, Legend, Line, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ChartCard, ProgressRing, StatusBadge } from '@/components/common';
import {
  acwrZone, getTestItem, latestResult, RESULT_DATES, resultSeries, RTP_LABEL, TEST_TASKS,
} from '@/data';
import type { Athlete, CoreMetricId } from '@/data';
import { judgeVsNorm, NORM_STATUS_COLOR, normFor } from '@/data/norms';
import { cn } from '@/lib/utils';
import { DarkTooltip, TooltipRow } from './chartTheme';
import { AXIS_TICK, GRID_STROKE, NORM_FILL } from './chartConsts';
import { lastDelta, sixDimRadar, weeklyLoad } from './utils';

const QUICK_METRICS: CoreMetricId[] = ['E01', 'S02', 'P01', 'T02'];

/** 下次计划测试：从任务看板找范围匹配的进行中/未开始任务 */
function nextTaskFor(a: Athlete): string {
  const t = TEST_TASKS.find(
    (task) =>
      task.status !== '已完成' &&
      (task.scope === '全队' || task.scope.includes(a.group) ||
        (task.scope === 'U17+U18' && (a.group === 'U17' || a.group === 'U18')) ||
        (task.scope === 'U13+U14' && (a.group === 'U13' || a.group === 'U14')) ||
        (task.scope === 'U15+U16' && (a.group === 'U15' || a.group === 'U16'))),
  );
  return t ? `${t.title.slice(0, 14)}… · ${t.window}` : '暂无计划';
}

function RecentResultRow({ athlete, itemId }: { athlete: Athlete; itemId: CoreMetricId }) {
  const item = getTestItem(itemId)!;
  const latest = latestResult(athlete.id, itemId);
  const d = lastDelta(athlete.id, itemId);
  if (!latest) return null;
  const status = judgeVsNorm(latest.value, itemId, athlete.group);
  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <span className="w-28 truncate text-sm text-text-2">{item.name}</span>
      <span className="text-cell-num font-semibold text-text-1 tnum">
        {latest.value}
        <span className="ml-0.5 text-[11px] font-normal text-text-3">{item.unit}</span>
      </span>
      {d && (
        <span className={cn('inline-flex items-center font-mono-data text-[11px]', d.good ? 'text-ok' : 'text-risk')}>
          {d.dir === 'flat' ? (
            <Minus className="h-3 w-3 text-text-3" />
          ) : d.dir === 'up' ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {d.text}
        </span>
      )}
      <span className="ml-auto h-2 w-2 rounded-full" style={{ background: NORM_STATUS_COLOR[status] }} title={`常模判定：${status}`} />
    </div>
  );
}

export default function OverviewTab({ athlete }: { athlete: Athlete }) {
  const radarData = useMemo(() => sixDimRadar(athlete), [athlete]);

  // 成长速览：Yo-Yo + 30m 双系列
  const combo = useMemo(() => {
    const yy = resultSeries(athlete.id, 'E01');
    const sp = resultSeries(athlete.id, 'S02');
    return RESULT_DATES.map((d, i) => ({
      date: d.slice(5),
      yoyo: yy[i]?.value ?? null,
      sprint: sp[i]?.value ?? null,
    }));
  }, [athlete.id]);
  const yyNorm = normFor('E01', athlete.group);
  // Y 轴范围纳入常模带，避免 ReferenceArea 被裁剪
  const yyDomain = useMemo((): [number, number] => {
    const vals = combo.map((c) => c.yoyo).filter((v): v is number => typeof v === 'number');
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (yyNorm) {
      lo = Math.min(lo, ...yyNorm);
      hi = Math.max(hi, ...yyNorm);
    }
    const pad = (hi - lo) * 0.12;
    return [lo - pad, hi + pad];
  }, [combo, yyNorm]);
  const spDomain = useMemo((): [number, number] => {
    const vals = combo.map((c) => c.sprint).filter((v): v is number => typeof v === 'number');
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return [lo - 0.05, hi + 0.05];
  }, [combo]);

  const acwr = athlete.acwr;
  const acwrTone = acwr === null ? 'red' : acwrZone(acwr);

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* 六维能力雷达 */}
      <ChartCard title="六维能力雷达" subtitle="0–100 标准化 · 虚线为同龄常模均值" className="col-span-12 lg:col-span-4">
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid stroke={GRID_STROKE} />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: '#475569' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={athlete.name} dataKey="athlete" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2.5} isAnimationActive animationDuration={800} />
            <Radar name="同龄常模均值" dataKey="normAvg" stroke="#94A3B8" strokeDasharray="5 4" fill="none" strokeWidth={1.5} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <DarkTooltip>
                {payload.map((p) => (
                  <TooltipRow key={String(p.name)} color={String(p.color)} name={String(p.name)} value={String(p.value)} />
                ))}
              </DarkTooltip>
            ) : null} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 近期状态卡 */}
      <ChartCard title="近期状态" subtitle={`数据截至 ${RESULT_DATES[RESULT_DATES.length - 1]}`} className="col-span-12 lg:col-span-4">
        <div className="flex items-center gap-5">
          <ProgressRing
            value={acwr === null ? 12 : Math.min(100, (acwr / 2) * 100)}
            tone={acwrTone}
            size={104}
            label="ACWR"
          />
          <div className="flex-1 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-3">RTP 状态</span>
              <StatusBadge tone={athlete.rtp} label={RTP_LABEL[athlete.rtp]} pulse={athlete.rtp === 'red'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-3">本周负荷</span>
              <span className="text-cell-num text-text-1 tnum">{acwr === null ? '—' : weeklyLoad(athlete.id)} AU</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-3">ACWR</span>
              <span className="text-cell-num font-semibold tnum" style={{ color: acwrTone === 'green' ? '#16A34A' : acwrTone === 'amber' ? '#D97706' : '#DC2626' }}>
                {acwr === null ? '停训' : acwr.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
          <div className="flex justify-between">
            <span className="text-text-3">上次测试</span>
            <span className="font-mono-data text-text-2">{RESULT_DATES[RESULT_DATES.length - 1]}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-text-3">下次计划</span>
            <span className="truncate text-text-2" title={nextTaskFor(athlete)}>{nextTaskFor(athlete)}</span>
          </div>
        </div>
      </ChartCard>

      {/* 最近成绩速览 */}
      <ChartCard title="最近成绩速览" subtitle="核心指标最新值与环比" className="col-span-12 lg:col-span-4">
        <div className="pt-1">
          {QUICK_METRICS.map((m) => (
            <RecentResultRow key={m} athlete={athlete} itemId={m} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-3">状态点：蓝=优秀 绿=达标 黄=关注 红=待提升</p>
      </ChartCard>

      {/* 成长速览（通栏） */}
      <ChartCard
        title="成长速览 · 近 8 次"
        subtitle={`Yo-Yo IR1（左轴，含 ${athlete.group} 常模带）+ 30m 冲刺（右轴）`}
        className="col-span-12"
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={combo} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis yAxisId="yy" tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} domain={yyDomain} />
            <YAxis yAxisId="sp" orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={spDomain} />
            {yyNorm && (
              <ReferenceArea yAxisId="yy" y1={Math.min(...yyNorm)} y2={Math.max(...yyNorm)} fill={NORM_FILL} stroke="#2563EB" strokeOpacity={0.35} strokeDasharray="4 4" />
            )}
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <DarkTooltip title={String(label)}>
                {payload.map((p) => (
                  <TooltipRow
                    key={String(p.dataKey)}
                    color={String(p.color)}
                    name={String(p.name)}
                    value={`${p.value}${p.dataKey === 'yoyo' ? 'm' : 's'}`}
                  />
                ))}
                <p className="pt-0.5 text-[10px] text-slate-400">常模带：{athlete.group} Yo-Yo P25–P75</p>
              </DarkTooltip>
            ) : null} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
            <Line yAxisId="yy" name="Yo-Yo IR1 (m)" type="monotone" dataKey="yoyo" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line yAxisId="sp" name="30m 冲刺 (s)" type="monotone" dataKey="sprint" stroke="#06B6D4" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
