/**
 * /combo — 组合测试调度（combo-testing.md）
 * 深色组合模型流程图解 + 会话调度条 + 成绩榜 ↔ 高阶画像联动 + 四象限散点
 */

import { useMemo, useState } from 'react';
import { Plus, Radio, Gauge, Download, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { COMBO_RECORDS, COMBO_SESSIONS } from '@/data';
import ComboModelFlow from '@/components/combo/ComboModelFlow';
import SessionScheduler from '@/components/combo/SessionScheduler';
import ComboLeaderboard from '@/components/combo/ComboLeaderboard';
import ProfilePanel from '@/components/combo/ProfilePanel';
import PviScatter from '@/components/combo/PviScatter';
import { cn } from '@/lib/utils';

export default function ComboTesting() {
  const { role } = useRole();
  const { toast } = useToast();
  const isFitness = role === 'fitness';
  const isAnalyst = role === 'analyst';

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('A05');

  /** 会话过滤后的成绩记录（PVI 降序） */
  const records = useMemo(() => {
    const session = COMBO_SESSIONS.find((s) => s.id === sessionId);
    const list = session
      ? COMBO_RECORDS.filter((r) => session.athleteIds.includes(r.athleteId))
      : COMBO_RECORDS;
    return [...list].sort((a, b) => b.pvi - a.pvi);
  }, [sessionId]);

  /** 面板显示记录：选中项被过滤掉时回退到当前列表首位 */
  const panelRecord = useMemo(
    () => records.find((r) => r.athleteId === selectedId) ?? records[0],
    [records, selectedId],
  );

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>组合测试调度</h1>
          <p className="mt-1 text-sm text-text-2">
            测力台 × 计时门 组合模型 · 从原始数据到高阶运动表现得分
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 设备状态（演示静态） */}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs text-text-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            <Gauge className="h-3.5 w-3.5 text-text-3" />
            测力台已连接
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs text-text-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            <Radio className="h-3.5 w-3.5 text-text-3" />
            计时门×4 已连接
          </span>
          {isAnalyst && (
            <button
              onClick={() => toast('已导出 CSV（演示）', 'info')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-xs font-medium text-text-2 transition-colors hover:border-brand-600 hover:text-brand-600"
            >
              <Download className="h-3.5 w-3.5" />
              导出数据集
            </button>
          )}
          <button
            onClick={isFitness ? () => toast('新建组合会话（演示）', 'info') : undefined}
            disabled={!isFitness}
            title={isFitness ? undefined : '仅体能师可新建会话（演示 RBAC）'}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-4 text-xs font-medium text-white shadow-card transition-all duration-150',
              'hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Plus className="h-4 w-4" />
            新建组合会话
          </button>
        </div>
      </div>

      {/* 只读角色提示 */}
      {!isFitness && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-600/20 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-700">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          当前角色仅可查看（演示 RBAC 权限隔离）{isAnalyst ? '，可导出数据集' : ''}，会话调度仅对体能师开放
        </div>
      )}

      {/* 组合模型说明卡 */}
      <ComboModelFlow />

      {/* 会话调度条 */}
      <SessionScheduler
        selectedId={sessionId}
        onSelect={setSessionId}
        canDrag={isFitness}
        onToast={toast}
      />

      {/* 高阶得分结果区（7/5） */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <ComboLeaderboard records={records} selectedId={panelRecord?.athleteId ?? selectedId} onSelect={setSelectedId} />
        </div>
        <div className="xl:col-span-5">
          {panelRecord ? (
            <ProfilePanel record={panelRecord} canEdit={isFitness} onToast={toast} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[14px] border border-line bg-white p-10 text-sm text-text-3 shadow-card">
              该会话暂无成绩记录
            </div>
          )}
        </div>
      </div>

      {/* 底部通栏散点 */}
      <PviScatter records={records} />
    </div>
  );
}
