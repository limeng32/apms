/**
 * ReportPreview — 报告中心右栏：灰底工作区 + sticky 工具条 + A4 纸张
 * 翻页 crossfade / 全屏预览 Modal / PDF 导出假进度 + Toast（reports.md §2.2）
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Download, Loader2, Maximize2 } from 'lucide-react';
import type { Report } from '@/data';
import { Modal, useToast } from '@/components/common';
import { cn } from '@/lib/utils';
import ReportPaper from './ReportPaper';
import { reportCode } from './ReportList';

type ExportState = 'idle' | 'rendering' | 'done';

interface ReportPreviewProps {
  report: Report | null;
}

export default function ReportPreview({ report }: ReportPreviewProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 切换报告时回到第 1 页并重置导出态
  useEffect(() => {
    setPage(1);
    setExportState('idle');
    setProgress(0);
  }, [report?.id]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  if (!report) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-[14px] border border-line bg-[#EDF0F5] shadow-card">
        <p className="text-sm text-text-3">从左侧选择一份报告开始预览</p>
      </div>
    );
  }

  const totalPages = report.pages;
  const code = reportCode(report);

  const startExport = () => {
    if (exportState !== 'idle') return;
    setExportState('rendering');
    setProgress(0);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / 1800) * 100));
      setProgress(p);
      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setExportState('done');
        toast(`${code}.pdf 已导出（演示，未生成真实文件）`, 'success');
        setTimeout(() => setExportState('idle'), 1600);
      }
    }, 50);
  };

  const pager = (dark = false) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page <= 1}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35',
          dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-line text-text-2 hover:bg-canvas',
        )}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className={cn('px-1.5 font-mono-data text-xs', dark ? 'text-white/80' : 'text-text-2')}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={page >= totalPages}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35',
          dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-line text-text-2 hover:bg-canvas',
        )}
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const exportButton = (
    <button
      onClick={startExport}
      disabled={exportState === 'rendering'}
      className={cn(
        'relative flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-3.5 text-xs font-semibold text-white transition-all active:scale-[0.97]',
        exportState === 'done' ? 'bg-ok' : 'bg-btn-brand hover:bg-btn-brand-hover',
        exportState === 'rendering' && 'cursor-wait',
      )}
    >
      {exportState === 'rendering' && (
        <span
          className="absolute inset-y-0 left-0 bg-white/20 transition-all"
          style={{ width: `${progress}%` }}
        />
      )}
      {exportState === 'idle' && <><Download className="h-3.5 w-3.5" />导出 PDF</>}
      {exportState === 'rendering' && (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" />正在渲染 PDF… <span className="font-mono-data">{progress}%</span></>
      )}
      {exportState === 'done' && <><Check className="h-3.5 w-3.5" />已导出</>}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#EDF0F5] shadow-card">
      {/* sticky 工具条 */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/90 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[13px] font-semibold text-text-1">{report.title}</span>
          <span className="hidden shrink-0 rounded-md bg-canvas px-1.5 py-0.5 font-mono-data text-[10px] text-text-3 sm:inline">
            {code}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pager()}
          <button
            onClick={() => setFullscreen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-text-2 transition-colors hover:bg-canvas"
            aria-label="全屏预览"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {exportButton}
        </div>
      </div>

      {/* A4 纸张工作区 */}
      <div className="max-h-[calc(100dvh-220px)] overflow-y-auto p-6">
        <motion.div
          key={report.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-[720px]"
        >
          <ReportPaper report={report} page={page} />
        </motion.div>
      </div>

      {/* 全屏预览 */}
      <Modal open={fullscreen} onClose={() => setFullscreen(false)} width={860}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-1">{report.title}</p>
          {pager(true)}
        </div>
        <div className="max-h-[72dvh] overflow-y-auto rounded-lg bg-[#EDF0F5] p-4">
          <div className="mx-auto max-w-[680px]">
            <ReportPaper report={report} page={page} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
