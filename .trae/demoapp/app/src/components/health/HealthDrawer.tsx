/**
 * HealthDrawer — 运动员健康详情抽屉（health-warning.md §3 交互）
 * 伤病史 + RTP 迷你时间线 + 近 4 周负荷迷你图
 */

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import { Drawer, Avatar, AgeBadge, StatusBadge } from '@/components/common';
import {
  RTP_LABEL, RTP_STAGES, injuriesByAthlete, athleteAcwrSeries,
  type Athlete, type RTPStatus,
} from '@/data';
import { shortDate } from './healthUtils';

interface HealthDrawerProps {
  athlete: Athlete | null;
  rtpOverride?: RTPStatus;
  stageOverrides: Record<string, number>;
  onClose: () => void;
}

const SEVERITY_TONE = { 轻: 'green', 中: 'amber', 重: 'red' } as const;

export default function HealthDrawer({ athlete, rtpOverride, stageOverrides, onClose }: HealthDrawerProps) {
  const injuries = useMemo(() => (athlete ? injuriesByAthlete(athlete.id) : []), [athlete]);
  const loadSeries = useMemo(() => {
    if (!athlete) return [];
    return athleteAcwrSeries(athlete.id)
      .slice(-4)
      .map((p) => ({ week: shortDate(p.week), acute: p.acute, acwr: p.acwr }));
  }, [athlete]);

  if (!athlete) return null;
  const rtp = rtpOverride ?? athlete.rtp;

  return (
    <Drawer open={!!athlete} onClose={onClose} title="运动员健康详情" width={520}>
      {/* 头部 */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas/60 p-4">
        <Avatar name={athlete.name} group={athlete.group} size={44} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-text-1">{athlete.name}</span>
            <AgeBadge group={athlete.group} />
            <span className="text-xs text-text-3">{athlete.position}</span>
          </div>
          <p className="mt-0.5 text-xs text-text-3">
            身高 {athlete.height}cm · 体重 {athlete.weight}kg · ACWR{' '}
            <span className="font-mono-data tnum">{athlete.acwr?.toFixed(2) ?? '—（停训）'}</span>
          </p>
        </div>
        <StatusBadge tone={rtp} label={RTP_LABEL[rtp]} />
      </div>

      {/* 近 4 周负荷迷你图 */}
      <div className="mt-4 rounded-xl border border-line p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-text-1">
          <Activity className="h-4 w-4 text-brand-500" />
          近 4 周急性负荷（AU）
        </div>
        <div className="mt-2 h-[90px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={loadSeries} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="hd-load" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
              <Area type="monotone" dataKey="acute" stroke="#3B82F6" strokeWidth={2.5} fill="url(#hd-load)"
                dot={{ r: 3, fill: '#3B82F6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-text-3">
          {loadSeries.map((p) => (
            <span key={p.week} className="font-mono-data tnum">
              {p.week} · {p.acute}
            </span>
          ))}
        </div>
      </div>

      {/* 伤病史 + RTP 迷你时间线 */}
      <div className="mt-4">
        <h3 className="mb-2">伤病史（{injuries.length}）</h3>
        {injuries.length === 0 && <p className="text-xs text-text-3">无伤病记录，保持健康监控。</p>}
        <div className="flex flex-col gap-3">
          {injuries.map((inj) => {
            const stage = stageOverrides[inj.id] ?? inj.rtpStage;
            return (
              <div key={inj.id} className="rounded-xl border border-line p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-1">{inj.type}</p>
                  <StatusBadge
                    tone={inj.status === 'recovered' ? 'green' : SEVERITY_TONE[inj.severity]}
                    label={inj.status === 'recovered' ? '已康复' : inj.activeKind ?? '活跃'}
                    pulse={false}
                  />
                </div>
                <p className="mt-1 text-xs text-text-3">
                  {inj.site} · {inj.mechanism} · 伤发 <span className="font-mono-data tnum">{inj.date}</span>
                  {' '}· 预计复出 <span className="font-mono-data tnum">{shortDate(inj.estReturn)}</span>
                </p>
                {/* RTP 迷你时间线 */}
                <div className="mt-3 flex items-center">
                  {RTP_STAGES.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: i < stage || stage === 4 ? '#16A34A' : i === stage ? '#2563EB' : '#CBD5E1' }}
                        >
                          {i + 1}
                        </span>
                        <span className="whitespace-nowrap text-[10px] text-text-3">{s}</span>
                      </div>
                      {i < RTP_STAGES.length - 1 && (
                        <span className="mx-1 mb-4 h-0.5 flex-1 rounded" style={{ background: i < stage ? '#16A34A' : '#E5E9F0' }} />
                      )}
                    </div>
                  ))}
                </div>
                {inj.note && <p className="mt-2 rounded-lg bg-canvas px-2.5 py-2 text-xs leading-5 text-text-2">{inj.note}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
