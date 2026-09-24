/**
 * MedicalTab — 档案 Tab5「医疗康复」（roster.md §B Tab5）
 * 伤病史表格 + 活跃伤病 RTP 步骤条 + EMR/影像附件区（演示）
 * 非队医角色：只读蓝条提示，编辑按钮隐藏
 */

import { useMemo, useState } from 'react';
import { FileImage, Lock, PencilLine } from 'lucide-react';
import { ChartCard, EmptyState, Modal, StatusBadge, useToast } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { injuriesByAthlete, RTP_STAGES } from '@/data';
import type { Athlete, Injury } from '@/data';
import RTPStepper from './RTPStepper';

const SEVERITY_TONE: Record<Injury['severity'], 'green' | 'amber' | 'red'> = { 轻: 'green', 中: 'amber', 重: 'red' };

const ATTACHMENTS = ['膝关节 MRI 平扫', '超声影像 · 股二头肌', 'EMR 初诊记录', '康复评定表'];

export default function MedicalTab({ athlete }: { athlete: Athlete }) {
  const { role } = useRole();
  const { toast } = useToast();
  const [viewer, setViewer] = useState<string | null>(null);
  const isDoctor = role === 'doctor';
  const records = useMemo(() => injuriesByAthlete(athlete.id), [athlete.id]);
  const active = records.find((r) => r.status === 'active');

  return (
    <div className="space-y-5">
      {/* 只读提示（非队医） */}
      {!isDoctor && (
        <div className="flex items-center gap-2 rounded-[14px] border border-[#BFDBFE] bg-brand-50 px-4 py-2.5 text-sm text-brand-600">
          <Lock className="h-4 w-4" />
          您以只读模式查看医疗记录（演示 RBAC）
        </div>
      )}

      {/* 活跃伤病 RTP 时间线 */}
      {active && (
        <ChartCard
          title={`当前康复进程 · ${active.type}`}
          subtitle={`伤发 ${active.date} · 预计复出 ${active.estReturn} · 主责队医：${active.doctor}`}
          actions={
            isDoctor ? (
              <button
                onClick={() => toast('RTP 阶段更新（演示环境暂不支持）', 'info')}
                className="flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition-colors hover:bg-canvas"
              >
                <PencilLine className="h-3.5 w-3.5" />
                更新阶段
              </button>
            ) : undefined
          }
        >
          <RTPStepper stage={active.rtpStage} className="px-2 pt-2" />
          {active.note && (
            <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-sm leading-6 text-text-2">
              <span className="font-medium text-text-1">队医备注：</span>
              {active.note}
            </p>
          )}
        </ChartCard>
      )}

      {/* 伤病史表格 */}
      <ChartCard title="伤病史" subtitle={`共 ${records.length} 条记录`} bodyClassName="p-0">
        {records.length === 0 ? (
          <EmptyState title="暂无伤病记录" desc="该运动员无历史伤病台账记录" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">诊断</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">部位</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">伤发日期</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">程度</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">状态</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">RTP 阶段</th>
                <th className="px-5 py-2.5 text-left text-micro uppercase text-text-3">预计 / 实际复出</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-[#F8FAFF]">
                  <td className="px-5 py-3 font-medium text-text-1">{r.type}</td>
                  <td className="px-5 py-3 text-text-2">{r.site}</td>
                  <td className="px-5 py-3 font-mono-data text-[13px] text-text-2">{r.date}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={SEVERITY_TONE[r.severity]} label={r.severity} pulse={false} />
                  </td>
                  <td className="px-5 py-3">
                    {r.status === 'recovered' ? (
                      <StatusBadge tone="green" label="已康复" pulse={false} />
                    ) : (
                      <StatusBadge tone={r.activeKind === '停训' ? 'red' : 'amber'} label={r.activeKind ?? '活跃'} pulse={r.activeKind === '停训'} />
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-2">
                    <span className="font-mono-data text-[13px]">{r.rtpStage}</span> · {RTP_STAGES[r.rtpStage]}
                  </td>
                  <td className="px-5 py-3 font-mono-data text-[13px] text-text-2">{r.estReturn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>

      {/* 附件区：EMR / 影像（演示占位） */}
      <ChartCard title="EMR 与影像附件" subtitle="演示占位 · 点击查看大图">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ATTACHMENTS.map((name, i) => (
            <button
              key={name}
              onClick={() => setViewer(name)}
              className="group overflow-hidden rounded-xl border border-line text-left transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-ink-800 to-ink-700">
                <FileImage className="h-7 w-7 text-cyan-500/70 transition-transform group-hover:scale-110" />
              </div>
              <div className="bg-white px-3 py-2">
                <p className="truncate text-xs font-medium text-text-1">{name}</p>
                <p className="mt-0.5 font-mono-data text-[10px] text-text-3">IMG_{2025060 + i}.dcm</p>
              </div>
            </button>
          ))}
        </div>
      </ChartCard>

      {/* 查看大图 Modal */}
      <Modal open={viewer !== null} onClose={() => setViewer(null)} title={viewer ?? ''}>
        <div className="flex h-64 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900 to-ink-800">
          <div className="text-center">
            <FileImage className="mx-auto h-10 w-10 text-cyan-500/70" />
            <p className="mt-3 text-sm text-slate-300">影像预览（演示占位）</p>
            <p className="mt-1 font-mono-data text-xs text-slate-500">DICOM viewer 未在演示环境启用</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
