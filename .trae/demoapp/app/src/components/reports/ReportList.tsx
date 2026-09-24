/**
 * ReportList — 报告中心左栏：Tab/搜索/状态过滤 + 报告卡列表 + 批量导出
 * reports.md §2.1
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Check,
  Download,
  FileText,
  Loader2,
  Plus,
  Search,
  Stethoscope,
} from 'lucide-react';
import type { Report, ReportStatus, ReportType } from '@/data';
import { ROLES } from '@/data';
import { useToast, EmptyState } from '@/components/common';
import { cn } from '@/lib/utils';

type TabKey = '全部' | ReportType;
type StatusFilter = '全部' | ReportStatus;

const STATUS_TONE: Record<ReportStatus, { dot: string; text: string }> = {
  已生成: { dot: '#16A34A', text: '#16A34A' },
  生成中: { dot: '#D97706', text: '#D97706' },
  草稿: { dot: '#94A3B8', text: '#64748B' },
};

function typeIcon(r: Report) {
  if (r.authorRole === 'doctor') return Stethoscope;
  if (r.type === '团队') return BarChart3;
  return FileText;
}

/** 报告编号：RPT-年-对象-序号 */
export function reportCode(r: Report): string {
  const year = r.date.slice(0, 4);
  const target = r.athleteId ?? (r.scope ?? 'TEAM').replace(/[^A-Za-z0-9]/g, '');
  return `RPT-${year}-${target}-${r.id.slice(1).padStart(2, '0')}`;
}

interface ReportListProps {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGenerate: () => void;
  /** 生成中报告的进度（0–100），由页面层驱动 */
  generatingProgress: number;
}

export default function ReportList({ reports, selectedId, onSelect, onGenerate, generatingProgress }: ReportListProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('全部');
  const [status, setStatus] = useState<StatusFilter>('全部');
  const [query, setQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const counts = useMemo(() => ({
    全部: reports.length,
    个人: reports.filter((r) => r.type === '个人').length,
    团队: reports.filter((r) => r.type === '团队').length,
  }), [reports]);

  const filtered = useMemo(() => reports.filter((r) => {
    if (tab !== '全部' && r.type !== tab) return false;
    if (status !== '全部' && r.status !== status) return false;
    if (query.trim() && !r.title.includes(query.trim()) && !r.author.includes(query.trim())) return false;
    return true;
  }), [reports, tab, status, query]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startBatchExport = () => {
    if (checked.size === 0 || exporting) return;
    setExporting(true);
    setExportProgress(0);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / 2000) * 100));
      setExportProgress(p);
      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setExporting(false);
        toast(`已打包导出 ${checked.size} 份报告（演示，未生成真实文件）`, 'success');
        setChecked(new Set());
        setBatchMode(false);
      }
    }, 60);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[14px] border border-line bg-white shadow-card">
      {/* 头部：Tab + 生成按钮 */}
      <div className="border-b border-line px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(['全部', '个人', '团队'] as TabKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'relative rounded-t-lg px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors',
                  tab === t ? 'text-brand-600' : 'text-text-3 hover:text-text-1',
                )}
              >
                {t} <span className="font-mono-data text-xs">{counts[t]}</span>
                {tab === t && (
                  <motion.span
                    layoutId="report-tab-line"
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600"
                  />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={onGenerate}
            className="mb-1.5 flex h-8 items-center gap-1 rounded-lg bg-btn-brand px-3 text-xs font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            生成新报告
          </button>
        </div>
      </div>

      {/* 搜索 + 状态过滤 + 批量 */}
      <div className="space-y-2 border-b border-line px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索报告标题 / 生成人…"
            className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-text-3 focus:border-brand-500 focus:bg-white"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['全部', '已生成', '生成中', '草稿'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  status === s
                    ? 'border-brand-600 bg-brand-50 text-brand-600'
                    : 'border-line text-text-3 hover:border-text-3 hover:text-text-2',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setBatchMode((v) => !v); setChecked(new Set()); }}
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              batchMode ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line text-text-2 hover:bg-canvas',
            )}
          >
            {batchMode ? '退出批量' : '批量导出'}
          </button>
        </div>
      </div>

      {/* 批量操作条 */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-line bg-brand-50/60"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-xs text-text-2">
                已选 <span className="font-mono-data font-semibold text-brand-600">{checked.size}</span> 份
              </span>
              <button
                onClick={() => setChecked(new Set(filtered.filter((r) => r.status === '已生成').map((r) => r.id)))}
                className="text-xs text-brand-600 hover:underline"
              >
                全选已生成
              </button>
              <div className="flex-1" />
              {exporting ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${exportProgress}%` }} />
                  </div>
                  <span className="font-mono-data text-xs text-brand-600">{exportProgress}%</span>
                </div>
              ) : (
                <button
                  onClick={startBatchExport}
                  disabled={checked.size === 0}
                  className="flex h-7 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition-all hover:bg-brand-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  导出所选
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 报告卡列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <EmptyState title="没有匹配的报告" desc="试试调整筛选条件或搜索关键词" />
        ) : (
          <motion.ul
            key={`${tab}-${status}-${query}`}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-1"
          >
            {filtered.map((r) => {
              const Icon = typeIcon(r);
              const active = r.id === selectedId;
              const st = STATUS_TONE[r.status];
              const selectable = r.status === '已生成';
              return (
                <motion.li
                  key={r.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } } }}
                >
                  <button
                    onClick={() => (batchMode ? selectable && toggleCheck(r.id) : onSelect(r.id))}
                    className={cn(
                      'relative flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-150',
                      active && !batchMode
                        ? 'border-brand-600/20 bg-brand-50 shadow-[inset_3px_0_0_#2563EB]'
                        : 'hover:bg-canvas',
                      batchMode && !selectable && 'opacity-50',
                    )}
                  >
                    {batchMode && (
                      <span
                        className={cn(
                          'mt-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          checked.has(r.id) ? 'border-brand-600 bg-brand-600' : 'border-text-3 bg-white',
                        )}
                      >
                        {checked.has(r.id) && <Check className="h-3 w-3 text-white" />}
                      </span>
                    )}
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${ROLES[r.authorRole].color}14`, color: ROLES[r.authorRole].color }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-[13px] font-medium', active ? 'text-brand-700' : 'text-text-1')}>
                          {r.title}
                        </span>
                        {r.status === '生成中' ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs" style={{ color: st.text }}>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="font-mono-data">{r.id === '__generating__' ? `${generatingProgress}%` : '65%'}</span>
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: st.text }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                            {r.status}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-text-3">
                        {r.type}报告 · {r.author} · <span className="font-mono-data">{r.date}</span> · {r.pages} 页
                      </span>
                      {r.status === '生成中' && (
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
                          <motion.span
                            className="block h-full rounded-full bg-warn"
                            initial={{ width: '20%' }}
                            animate={{ width: r.id === '__generating__' ? `${generatingProgress}%` : '65%' }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                          />
                        </span>
                      )}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </div>
  );
}
