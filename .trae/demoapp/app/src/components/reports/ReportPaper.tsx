/**
 * ReportPaper — A4 纸张报告内容（reports.md §2.2 / §3）
 * page 1：封面带 + 信息条 + 结论徽章 + 指标诊断表
 * page 2：六维雷达 + 结论 + 训练建议 + 页脚
 * page 3+：占位灰格演示
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  LineChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Report } from '@/data';
import {
  NORM_STATUS_COLOR,
  NORM_STATUS_LABEL,
  SAMPLE_REPORT_CONCLUSIONS,
  SAMPLE_REPORT_METRICS,
  SAMPLE_REPORT_RADAR,
  SAMPLE_REPORT_SUGGESTIONS,
  TEAM_REPORT_OUTLIERS,
  TEAM_REPORT_PASSRATE,
  TEAM_REPORT_WEAKNESSES,
  getAthlete,
  resultSeries,
} from '@/data';
import type { CoreMetricId } from '@/data/testItems';
import { Avatar, AgeBadge } from '@/components/common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { reportCode } from './ReportList';

/** 诊断表指标名 → testResults 序列 id（仅 6 项有序列数据） */
const METRIC_SERIES: Record<string, CoreMetricId> = {
  'Yo-Yo IR1': 'E01',
  '30m 冲刺': 'S02',
  'Illinois 敏捷': 'S04',
  'CMJ 纵跳': 'P01',
  '带球绕杆': 'T01',
  '传球精准度': 'T02',
};

const POS_LABEL: Record<string, string> = { GK: '守门员', DF: '后卫', MF: '中场', FW: '前锋' };

function paperVariants() {
  return {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.985 },
  };
}

/** 封面页眉带（report-cover.png 背景 + 白字标题） */
function CoverBand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative overflow-hidden">
      <img
        src="/report-cover.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-900/70 to-ink-900/30" />
      <div className="relative flex items-end justify-between px-6 pb-5 pt-9">
        <div>
          <p className="text-micro text-white/60">APMS · CONFIDENTIAL</p>
          <h2 className="mt-1 text-lg font-bold leading-7 text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-white/70">{subtitle}</p>
        </div>
        <img src="/logo.svg" alt="APMS" className="h-9 w-9 opacity-90" />
      </div>
    </div>
  );
}

function InfoCell({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] leading-4 text-text-3">{label}</p>
      <p className={`truncate text-xs font-semibold leading-5 text-text-1 ${mono ? 'font-mono-data' : ''}`}>{value}</p>
    </div>
  );
}

/** 指标近 8 次 mini 趋势 Popover */
function MetricTrendPopover({ metricName, unit, children }: { metricName: string; unit: string; children: React.ReactNode }) {
  const itemId = METRIC_SERIES[metricName];
  const series = itemId ? resultSeries('A05', itemId) : [];
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center">
        <p className="text-xs font-semibold text-text-1">
          {metricName} · 近 8 次趋势 <span className="font-mono-data text-text-3">({unit || '—'})</span>
        </p>
        {series.length > 0 ? (
          <div className="mt-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} width={40} />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff' }}
                  labelStyle={{ color: '#94A3B8', fontSize: 10 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2, fill: '#2563EB' }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-canvas px-3 py-4 text-center text-xs text-text-3">该指标暂无纵向序列数据（演示）</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** 个人报告 page 1：信息条 + 徽章 + 诊断表 */
function IndividualPage1({ report }: { report: Report }) {
  const athlete = getAthlete(report.athleteId ?? 'A05');
  const a = athlete ?? getAthlete('A05')!;
  return (
    <>
      {/* ② 运动员信息条 */}
      <div className="mx-6 mt-4 flex items-center gap-4 rounded-xl border border-line bg-canvas/70 px-4 py-3">
        <Avatar name={a.name} group={a.group} size={40} />
        <div className="grid flex-1 grid-cols-6 gap-2">
          <InfoCell label="姓名" value={a.name} mono={false} />
          <InfoCell label="编号" value={a.id} />
          <InfoCell label="年龄组" value={a.group} />
          <InfoCell label="位置" value={POS_LABEL[a.position] ?? a.position} mono={false} />
          <InfoCell label="报告期" value="2025 春季" />
          <InfoCell label="生成人" value={report.author} mono={false} />
        </div>
      </div>

      {/* ③ 核心结论徽章行 */}
      <div className="mx-6 mt-3 flex items-stretch gap-2.5">
        <div className="flex items-center gap-2 rounded-xl bg-btn-brand px-4 py-2 text-white shadow-card">
          <span className="text-[10px] leading-4 text-white/70">综合评定</span>
          <span className="font-mono-data text-xl font-bold leading-6">A−</span>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-ok/20 bg-ok-bg px-3.5 py-1.5">
          <span className="text-[10px] leading-4 text-ok/80">较上期</span>
          <span className="font-mono-data text-sm font-bold leading-5 text-ok">+6 分 ↑</span>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-brand-600/20 bg-brand-50 px-3.5 py-1.5">
          <span className="text-[10px] leading-4 text-brand-600/80">同龄百分位</span>
          <span className="font-mono-data text-sm font-bold leading-5 text-brand-600">P78</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 self-center text-[10px] text-text-3">
          <AgeBadge group={a.group} />
          常模口径
        </div>
      </div>

      {/* ④ 指标诊断表 */}
      <div className="mx-6 mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-text-1">核心指标诊断</h3>
          <span className="text-[10px] text-text-3">点击行查看近 8 次趋势</span>
        </div>
        <table className="w-full border-collapse overflow-hidden rounded-xl text-left">
          <thead>
            <tr className="bg-canvas text-[10px] font-semibold uppercase tracking-wide text-text-3">
              <th className="px-3 py-2">指标</th>
              <th className="px-3 py-2 text-right">当前值</th>
              <th className="px-3 py-2 text-right">常模范围 (U17)</th>
              <th className="px-3 py-2">状态判定</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_REPORT_METRICS.map((m, i) => {
              const color = NORM_STATUS_COLOR[m.status];
              return (
                <MetricTrendPopover key={m.name} metricName={m.name} unit={m.unit}>
                  <tr
                    className={`cursor-pointer border-t border-line text-xs transition-colors hover:bg-[#F8FAFF] ${i % 2 === 1 ? 'bg-[#FAFBFD]' : 'bg-white'}`}
                  >
                    <td className="px-3 py-2 font-medium text-text-1">{m.name}</td>
                    <td className="px-3 py-2 text-right font-mono-data font-semibold text-text-1">
                      {m.value}<span className="ml-0.5 text-[10px] font-normal text-text-3">{m.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono-data text-text-2">{m.norm}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[11px] font-medium"
                        style={{ color, borderColor: `${color}40`, background: `${color}0F` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        {NORM_STATUS_LABEL[m.status]}
                      </span>
                    </td>
                  </tr>
                </MetricTrendPopover>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 个人报告 page 2：雷达 + 结论 + 建议 */
function IndividualPage2() {
  return (
    <div className="px-6 pt-5">
      <div className="grid grid-cols-2 gap-4">
        {/* ⑤ 六维雷达 */}
        <div className="rounded-xl border border-line p-3">
          <h3 className="px-1 text-[13px] font-semibold text-text-1">六维能力雷达</h3>
          <div className="mt-1 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={SAMPLE_REPORT_RADAR} outerRadius="72%">
                <PolarGrid stroke="#EEF2F7" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="本人" dataKey="athlete" stroke="#2563EB" fill="#2563EB" fillOpacity={0.25} strokeWidth={2} />
                <Radar name="位置常模" dataKey="normAvg" stroke="#94A3B8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 pb-1 text-[10px] text-text-3">
            <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-full bg-brand-600" />本人</span>
            <span className="flex items-center gap-1"><span className="h-0 w-4 border-t border-dashed border-text-3" />位置常模</span>
          </div>
        </div>

        {/* 教练结论 */}
        <div className="rounded-xl border border-line p-4">
          <h3 className="text-[13px] font-semibold text-text-1">结论</h3>
          <ol className="mt-2 space-y-2.5">
            {SAMPLE_REPORT_CONCLUSIONS.map((c, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-[18px] text-text-2">
                <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono-data text-[10px] font-semibold text-brand-600">
                  {i + 1}
                </span>
                {c}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ⑥ 训练建议卡 */}
      <div className="mt-4">
        <h3 className="text-[13px] font-semibold text-text-1">训练建议</h3>
        <div className="mt-2 space-y-2">
          {SAMPLE_REPORT_SUGGESTIONS.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-btn-brand font-mono-data text-[10px] font-bold text-white">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="flex-1 text-[11px] leading-[18px] text-text-2">{s}</p>
              <span className="mt-0.5 shrink-0 rounded-full border border-line bg-white px-2 py-px text-[10px] text-text-3">
                {['体能师 · 李泽锋', '体能师 · 李泽锋', '主教练 · 韩建国'][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PageFooter />
    </div>
  );
}

function PageFooter() {
  return (
    <p className="mt-5 border-t border-line pt-2.5 text-center text-[9px] leading-4 text-text-3">
      本报告由 APMS 演示系统自动生成 · 数据为模拟数据 · 2025-06-14
    </p>
  );
}

/** 团队报告 page 1（U15–U16 6月体能诊断周报） */
function TeamPage1({ report }: { report: Report }) {
  return (
    <>
      <div className="mx-6 mt-4 grid grid-cols-4 gap-2 rounded-xl border border-line bg-canvas/70 px-4 py-3">
        <InfoCell label="覆盖范围" value={report.scope ?? '全队'} />
        <InfoCell label="参测人数" value="8 人" />
        <InfoCell label="统计周期" value="2025-06-01 – 06-15" />
        <InfoCell label="生成人" value={report.author} mono={false} />
      </div>

      {/* 达标率横条图 */}
      <div className="mx-6 mt-4 rounded-xl border border-line p-3">
        <h3 className="px-1 text-[13px] font-semibold text-text-1">各指标达标率</h3>
        <div className="mt-1 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={TEAM_REPORT_PASSRATE} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="metric" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} width={72} />
              <Tooltip
                contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(v: number | string) => [`${v}%`, '达标率']}
              />
              <Bar dataKey="rate" radius={[0, 6, 6, 0]} barSize={14}>
                {TEAM_REPORT_PASSRATE.map((d) => (
                  <Cell key={d.metric} fill={d.rate >= 85 ? '#16A34A' : d.rate >= 70 ? '#3B82F6' : '#D97706'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 弱项 Top3 */}
      <div className="mx-6 mt-4">
        <h3 className="text-[13px] font-semibold text-text-1">弱项 Top 3</h3>
        <div className="mt-2 space-y-2">
          {TEAM_REPORT_WEAKNESSES.map((w, i) => (
            <div key={w.metric} className="flex items-start gap-3 rounded-xl border border-warn/25 bg-warn-bg/60 px-3.5 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-warn font-mono-data text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-text-1">{w.metric}</p>
                <p className="mt-0.5 text-[11px] leading-[17px] text-text-2">{w.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** 团队报告 page 2：离群个体 + 下周期建议 */
function TeamPage2() {
  return (
    <div className="px-6 pt-5">
      <h3 className="text-[13px] font-semibold text-text-1">个体离群名单</h3>
      <div className="mt-2 space-y-2">
        {TEAM_REPORT_OUTLIERS.map((o) => {
          const a = getAthlete(o.athleteId);
          if (!a) return null;
          const positive = o.athleteId === 'A15';
          return (
            <div
              key={o.athleteId}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                positive ? 'border-ok/25 bg-ok-bg/50' : 'border-risk/20 bg-risk-bg/50'
              }`}
            >
              <Avatar name={a.name} group={a.group} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-1">
                  {a.name} <span className="font-mono-data text-[10px] font-normal text-text-3">{a.id} · {a.group} · {POS_LABEL[a.position]}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-[17px] text-text-2">{o.reason}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  positive ? 'bg-ok/10 text-ok' : 'bg-risk/10 text-risk'
                }`}
              >
                {positive ? '优秀离群' : '风险离群'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-canvas/50 p-4">
        <h3 className="text-[13px] font-semibold text-text-1">下周期训练建议</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[11px] leading-[18px] text-text-2">
          <li>U16 组安排下肢力量补课模块（每周 2 次），重点跟踪 A09 / A14 的 CMJ 变化。</li>
          <li>结合 ACWR 预警下调高负荷球员的冲刺总量，30m 冲刺复测顺延至负荷回归绿区后。</li>
          <li>U15 组带球绕杆统一技术口径，安排 1 次控球稳定性专题课。</li>
        </ul>
      </div>
      <PageFooter />
    </div>
  );
}

/** 占位页（page 3+ 或非样例报告） */
function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col px-6 pt-5">
      <div className="flex items-center gap-2 text-text-3">
        <TrendingUp className="h-4 w-4" />
        <p className="text-xs">{label}</p>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-dashed border-line bg-canvas/60" />
        ))}
      </div>
      <PageFooter />
    </div>
  );
}

interface ReportPaperProps {
  report: Report;
  page: number;
}

export default function ReportPaper({ report, page }: ReportPaperProps) {
  const isSampleIndividual = report.id === 'R01';
  const isSampleTeam = report.id === 'R02';
  const hasRealContent = isSampleIndividual || isSampleTeam;

  return (
    <div className="relative w-full overflow-hidden rounded-[6px] bg-white shadow-lift" style={{ aspectRatio: '210 / 297' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${report.id}-${page}`}
          variants={paperVariants()}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute inset-0 flex flex-col"
        >
          {page === 1 && (
            <>
              <CoverBand
                title={report.type === '个人' ? '运动员综合诊断报告' : '团队体能诊断报告'}
                subtitle={`${report.title} · 编号 ${reportCode(report)}`}
              />
              <div className="flex-1 overflow-hidden">
                {isSampleIndividual && <IndividualPage1 report={report} />}
                {isSampleTeam && <TeamPage1 report={report} />}
                {!hasRealContent && (
                  <PlaceholderPage label="该报告正文为演示占位内容（仅样例报告含完整数据）" />
                )}
              </div>
            </>
          )}
          {page === 2 && (
            <div className="flex-1 overflow-hidden">
              {isSampleIndividual && <IndividualPage2 />}
              {isSampleTeam && <TeamPage2 />}
              {!hasRealContent && <PlaceholderPage label={`第 2 页 · 演示占位`} />}
            </div>
          )}
          {page >= 3 && <PlaceholderPage label={`第 ${page} 页 · 演示占位（无实内容）`} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
