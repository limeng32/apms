/**
 * GenerateModal — 「生成新报告」假流程（reports.md §1）
 * 选类型/对象 → 确认后关闭，由页面层插入"生成中"卡并驱动进度
 */

import { useMemo, useState } from 'react';
import { FileText, Users } from 'lucide-react';
import { Modal } from '@/components/common';
import { ATHLETES, type ReportType } from '@/data';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  /** 确认生成：回传标题/类型/对象 */
  onConfirm: (draft: { title: string; type: ReportType; athleteId?: string; scope?: string }) => void;
}

const TEAM_SCOPES = ['全队', 'U13–U14', 'U15–U16', 'U17–U18'];

export default function GenerateModal({ open, onClose, onConfirm }: GenerateModalProps) {
  const { roleInfo } = useRole();
  const [type, setType] = useState<ReportType>('个人');
  const [athleteId, setAthleteId] = useState('A05');
  const [scope, setScope] = useState(TEAM_SCOPES[0]);

  const title = useMemo(() => {
    if (type === '个人') {
      const a = ATHLETES.find((x) => x.id === athleteId);
      return `${a?.name ?? ''} · 2025 夏季综合诊断报告`;
    }
    return `${scope} 梯队 6 月综合诊断报告`;
  }, [type, athleteId, scope]);

  const confirm = () => {
    onConfirm(type === '个人' ? { title, type, athleteId } : { title, type, scope });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="生成新报告" width={480}>
      <p className="-mt-2 mb-4 text-xs text-text-3">
        以当前角色（<span style={{ color: roleInfo.color }}>{roleInfo.person} · {roleInfo.title}</span>）生成演示报告
      </p>

      {/* 类型选择 */}
      <div className="grid grid-cols-2 gap-2">
        {(['个人', '团队'] as ReportType[]).map((t) => {
          const Icon = t === '个人' ? FileText : Users;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all',
                type === t ? 'border-brand-600 bg-brand-50 shadow-glowBlue' : 'border-line hover:border-text-3',
              )}
            >
              <Icon className={cn('h-4 w-4', type === t ? 'text-brand-600' : 'text-text-3')} />
              <div>
                <p className={cn('text-sm font-semibold', type === t ? 'text-brand-700' : 'text-text-1')}>{t}报告</p>
                <p className="text-[11px] text-text-3">{t === '个人' ? '单个运动员综合诊断' : '年龄组/全队汇总诊断'}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 对象选择 */}
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-text-2">{type === '个人' ? '选择运动员' : '选择范围'}</p>
        {type === '个人' ? (
          <select
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
          >
            {ATHLETES.map((a) => (
              <option key={a.id} value={a.id}>{a.name}（{a.id} · {a.group} · {a.position}）</option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {TEAM_SCOPES.map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  scope === s ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-text-2 hover:border-text-3',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 预览标题 */}
      <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-3">
        <p className="text-[11px] text-text-3">将生成</p>
        <p className="mt-0.5 text-sm font-semibold text-text-1">{title}</p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-line px-4 text-sm font-medium text-text-2 transition-colors hover:bg-canvas"
        >
          取消
        </button>
        <button
          onClick={confirm}
          className="h-9 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
        >
          开始生成
        </button>
      </div>
    </Modal>
  );
}
