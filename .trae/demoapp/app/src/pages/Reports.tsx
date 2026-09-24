/**
 * Reports — 报告中心 `/reports`（reports.md）
 * 左列表 + 右 A4 预览双栏工作台；角色过滤 / 生成新报告假流程 / 批量导出
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { REPORTS, type Report, type RoleKey } from '@/data';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/common';
import ReportList from '@/components/reports/ReportList';
import ReportPreview from '@/components/reports/ReportPreview';
import GenerateModal from '@/components/reports/GenerateModal';

/** 角色可见的报告类别（reports.md §2.1 角色过滤演示）
 *  类别按报告生成人角色划分：doctor→医疗类 fitness→体能类 analyst→综合类 */
const VISIBLE_AUTHOR_ROLES: Record<RoleKey, RoleKey[] | null> = {
  coach: null,                                    // 全部
  analyst: null,                                  // 全部
  fitness: ['fitness', 'analyst'],                // 体能 + 综合
  doctor: ['doctor', 'analyst'],                  // 医疗 + 综合
};

export default function Reports() {
  const { role, roleInfo } = useRole();
  const { toast } = useToast();

  /** 本地追加的报告（生成新报告假流程产物） */
  const [extra, setExtra] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allReports = useMemo(() => [...extra, ...REPORTS], [extra]);

  /** 角色过滤后的可见列表 */
  const visible = useMemo(() => {
    const allow = VISIBLE_AUTHOR_ROLES[role];
    if (!allow) return allReports;
    return allReports.filter((r) => allow.includes(r.authorRole));
  }, [allReports, role]);

  // 保证选中项在可见列表内
  useEffect(() => {
    if (!selectedId || !visible.some((r) => r.id === selectedId)) {
      setSelectedId(visible.find((r) => r.status !== '草稿')?.id ?? visible[0]?.id ?? null);
    }
  }, [visible, selectedId]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const selected = visible.find((r) => r.id === selectedId) ?? null;

  /** 生成新报告假流程：插入"生成中"卡 → 2s 进度 → 变"已生成" + Toast */
  const handleGenerate = (draft: { title: string; type: Report['type']; athleteId?: string; scope?: string }) => {
    const id = '__generating__';
    const newReport: Report = {
      id,
      title: draft.title,
      type: draft.type,
      athleteId: draft.athleteId,
      scope: draft.scope,
      date: '2025-06-16',
      authorRole: role,
      author: roleInfo.person,
      pages: 8,
      status: '生成中',
    };
    setExtra((prev) => [newReport, ...prev.filter((r) => r.id !== id)]);
    setSelectedId(id);
    setGeneratingProgress(0);

    const started = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / 2000) * 100));
      setGeneratingProgress(p);
      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setExtra((prev) => prev.map((r) => (r.id === id ? { ...r, status: '已生成' as const } : r)));
        toast(`「${draft.title}」已生成（演示）`, 'success');
      }
    }, 60);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>报告中心</h1>
          <p className="mt-1 text-sm text-text-2">个人 / 团队综合诊断报告 · 自动生成 · 演示环境</p>
        </div>
        <p className="text-xs text-text-3">
          当前角色 <span className="font-semibold" style={{ color: roleInfo.color }}>{roleInfo.name}</span>
          {' · '}可见 {visible.length} / {allReports.length} 份报告
        </p>
      </div>

      {/* 双栏工作台 */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-1 gap-5 xl:grid-cols-12"
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } } }}
          className="xl:col-span-4"
        >
          <div className="flex max-h-[calc(100dvh-220px)] min-h-[420px] flex-col">
            <ReportList
              reports={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onGenerate={() => setModalOpen(true)}
              generatingProgress={generatingProgress}
            />
          </div>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } } }}
          className="xl:col-span-8"
        >
          {selected?.status === '草稿' ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center rounded-[14px] border border-dashed border-line bg-white shadow-card">
              <p className="text-sm font-medium text-text-2">「{selected.title}」仍为草稿</p>
              <p className="mt-1 text-xs text-text-3">草稿报告暂无预览内容（演示）</p>
            </div>
          ) : (
            <ReportPreview report={selected} />
          )}
        </motion.div>
      </motion.div>

      <GenerateModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleGenerate} />
    </div>
  );
}
