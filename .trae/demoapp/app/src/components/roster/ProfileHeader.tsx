/**
 * ProfileHeader — 360° 档案头部通栏卡（roster.md §B.1）
 * 大 Avatar + 姓名 + 状态区 + 4 枚 mini stat + 操作；红/黄运动员预警横幅
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardPlus, FileDown } from 'lucide-react';
import { Avatar, Modal, StatusBadge, useCountUp, useToast } from '@/components/common';
import { acwrZone, injuriesByAthlete, POSITION_LABEL, RTP_LABEL, RTP_STAGES } from '@/data';
import type { Athlete } from '@/data';
import { cn } from '@/lib/utils';

const ACWR_TEXT: Record<'green' | 'amber' | 'red', string> = { green: '正常', amber: '关注', red: '危险' };

function MiniStat({ label, value, unit, decimals = 0 }: { label: string; value: number; unit: string; decimals?: number }) {
  const display = useCountUp(value, 900, decimals);
  return (
    <div className="flex flex-col items-end">
      <span className="text-[11px] text-text-3">{label}</span>
      <span className="font-mono-data text-lg font-bold leading-6 text-text-1 tnum">
        {display}
        <span className="ml-0.5 text-[11px] font-medium text-text-3">{unit}</span>
      </span>
    </div>
  );
}

export default function ProfileHeader({ athlete }: { athlete: Athlete }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recordOpen, setRecordOpen] = useState(false);

  const activeInjury = injuriesByAthlete(athlete.id).find((i) => i.status === 'active');
  const acwrZoneOf = athlete.acwr === null ? 'red' : acwrZone(athlete.acwr);
  const bannerTone = athlete.rtp === 'red' ? 'red' : 'amber';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
      <div className="rounded-[14px] border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-5">
          {/* 左：头像 + 姓名 */}
          <div className="flex items-center gap-4">
            <Avatar name={athlete.name} group={athlete.group} size={72} />
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold leading-8 text-text-1">{athlete.name}</span>
                <StatusBadge tone={athlete.rtp} label={RTP_LABEL[athlete.rtp]} pulse={athlete.rtp === 'red'} />
                {athlete.acwr !== null && (
                  <StatusBadge tone={acwrZoneOf} label={`ACWR ${athlete.acwr.toFixed(2)} ${ACWR_TEXT[acwrZoneOf]}`} pulse={false} />
                )}
              </div>
              <p className="mt-1 text-sm text-text-2">
                {athlete.group} · {athlete.position} {POSITION_LABEL[athlete.position]} · 编号{' '}
                <span className="font-mono-data">{athlete.id}</span> · {athlete.joinYear} 年入队
              </p>
              <p className="mt-0.5 text-xs text-text-3">
                出生 {athlete.birth} · 优势腿{athlete.dominantLeg} · 预测 PHV{' '}
                <span className="font-mono-data">{athlete.phvAge}</span> 岁 · 成熟度偏移{' '}
                <span className="font-mono-data">
                  {athlete.maturityOffset > 0 ? '+' : ''}
                  {athlete.maturityOffset}
                </span>{' '}
                岁
              </p>
            </div>
          </div>

          {/* 右：KPI mini stat 条 + 操作 */}
          <div className="ml-auto flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-6 border-r border-line pr-6">
              <MiniStat label="身高" value={athlete.height} unit="cm" />
              <MiniStat label="体重" value={athlete.weight} unit="kg" />
              <MiniStat label="体脂" value={athlete.bodyFat} unit="%" decimals={1} />
              <MiniStat label="预测成年身高" value={athlete.predictedHeight} unit="cm" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  toast('已跳转报告中心并预选该运动员（演示）', 'info');
                  navigate('/reports');
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-text-2 transition-all hover:bg-canvas active:scale-[0.97]"
              >
                <FileDown className="h-4 w-4" />
                导出个人报告
              </button>
              <button
                onClick={() => setRecordOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-3.5 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
              >
                <ClipboardPlus className="h-4 w-4" />
                记录体测
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 红/黄预警横幅 */}
      {activeInjury && athlete.rtp !== 'green' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          className={cn(
            'mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] border px-4 py-3 text-sm',
            bannerTone === 'red' ? 'border-[#F3C1C1] bg-risk-bg text-risk' : 'border-[#F5D9A8] bg-warn-bg text-warn',
          )}
        >
          <span className="font-semibold">
            {activeInjury.type}（{activeInjury.site}）
          </span>
          <span>
            RTP 第 {activeInjury.rtpStage} 阶段 · {RTP_STAGES[activeInjury.rtpStage]}
          </span>
          <span>
            预计复出 <span className="font-mono-data">{activeInjury.estReturn}</span>
          </span>
          <span>主责队医：{activeInjury.doctor}</span>
        </motion.div>
      )}

      {/* 记录体测演示 Modal */}
      <Modal open={recordOpen} onClose={() => setRecordOpen(false)} title={`记录体测 · ${athlete.name}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-3">
              测试指标
              <select className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm text-text-1 outline-none focus:border-brand-500">
                <option>Yo-Yo IR1 (m)</option>
                <option>30m 冲刺 (s)</option>
                <option>CMJ 纵跳 (cm)</option>
              </select>
            </label>
            <label className="text-xs text-text-3">
              成绩
              <input
                placeholder="如 1680"
                className="mt-1 h-9 w-full rounded-lg border border-line px-2 font-mono-data text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>
          <label className="block text-xs text-text-3">
            备注
            <textarea
              rows={2}
              placeholder="场地 / 天气 / 设备备注…"
              className="mt-1 w-full rounded-lg border border-line p-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setRecordOpen(false)}
              className="h-9 rounded-lg border border-line px-4 text-sm text-text-2 transition-colors hover:bg-canvas"
            >
              取消
            </button>
            <button
              onClick={() => {
                setRecordOpen(false);
                toast('体测记录已保存（模拟）');
              }}
              className="h-9 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
            >
              保存记录
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
