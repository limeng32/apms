/**
 * InjuryDrawer — 伤病详情抽屉（medical.md §4，560px）
 * RTP 五阶段康复时间线 + ETA 卡 + 复出测试达标卡 + EMR/影像归档上传演示 + 医嘱备注
 * 非队医角色：脱敏只读视图（医嘱/影像打码，上传区隐藏）
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileUp, Image as ImageIcon, Loader2, Paperclip, Plus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, Modal, Avatar, AgeBadge, StatusBadge, useToast } from '@/components/common';
import { RTP_STAGES, getAthlete, type Injury } from '@/data';
import { daysUntil, shortDate, seededHash } from '@/components/health/healthUtils';

// ---------- 阶段内容 ----------

interface StageInfo { dateRange: string; summary: string; progress?: number }

/** INJ01 周子昂：按 medical.md §4.2 照抄 */
const INJ01_STAGES: StageInfo[] = [
  { dateRange: '5.28–5.31', summary: 'RICE + 疼痛管理，MRI 确认 II 级' },
  { dateRange: '6.01–6.12', summary: '关节活动度恢复 95%，等长力量训练' },
  { dateRange: '6.13– 进行中', summary: '离心腘绳力量 65%→目标 85%，直线跑解禁', progress: 65 },
  { dateRange: '预计 6.26', summary: '变向/冲刺/有球训练渐进' },
  { dateRange: '预计 7.05', summary: '通过复出测试（单腿CMJ差<10%）' },
];

const GENERIC_SUMMARY = [
  'RICE 急性期处理 + 疼痛管理，影像检查确认分级',
  '关节活动度恢复，等长力量训练介入',
  '离心力量重建，直线跑/基础体能渐进',
  '变向/冲刺/有球专项训练渐进',
  '通过复出测试，回归全队合练',
];

function stageInfos(inj: Injury, stage: number): StageInfo[] {
  if (inj.id === 'INJ01') return INJ01_STAGES;
  // 其余记录：在伤发日–预计复出日间均分 5 段（演示推导）
  const start = new Date(inj.date + 'T00:00:00').getTime();
  const end = new Date(inj.estReturn + 'T00:00:00').getTime();
  const seg = Math.max((end - start) / 5, 86400000);
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
  };
  return RTP_STAGES.map((_, i) => ({
    dateRange:
      inj.status === 'recovered' || i < stage
        ? `${fmt(start + i * seg)}–${fmt(start + (i + 1) * seg)}`
        : i === stage
          ? `${fmt(start + i * seg)}– 进行中`
          : `预计 ${fmt(start + i * seg)}`,
    summary: GENERIC_SUMMARY[i],
    progress: i === stage && inj.status === 'active' ? 40 + stage * 10 : undefined,
  }));
}

// ---------- 复出测试门槛 ----------

interface Gate { label: string; current: string; pct: number; tone: 'green' | 'amber' | 'red' }

const INJ01_GATES: Gate[] = [
  { label: '单腿CMJ不对称 ≤10%', current: '当前 14%', pct: 60, tone: 'amber' },
  { label: '腘绳离心力量 ≥85% 健侧', current: '当前 65%', pct: 65, tone: 'red' },
  { label: '无痛全幅度冲刺 ✓', current: '6.15 达成', pct: 100, tone: 'green' },
];

function genericGates(stage: number): Gate[] {
  const strength = Math.min(95, 40 + stage * 15);
  return [
    { label: '患处力量 ≥85% 健侧', current: `当前 ${strength}%`, pct: strength, tone: strength >= 85 ? 'green' : strength >= 60 ? 'amber' : 'red' },
    { label: '无痛全幅度活动', current: stage >= 2 ? '已达成' : '未达成', pct: stage >= 2 ? 100 : 40, tone: stage >= 2 ? 'green' : 'amber' },
    { label: '专项动作完成度', current: `当前 ${Math.min(100, stage * 25)}%`, pct: Math.min(100, stage * 25), tone: stage >= 4 ? 'green' : 'amber' },
  ];
}

// ---------- 附件 ----------

interface Attachment { name: string; ext: string }

function defaultAttachments(inj: Injury): Attachment[] {
  if (inj.id === 'INJ01') {
    return [
      { name: 'MRI_右大腿_0530.dcm', ext: 'DICOM' },
      { name: '超声复查_0612.jpg', ext: 'JPG' },
      { name: '初诊病历_0528.pdf', ext: 'PDF' },
      { name: '康复训练单_0613.pdf', ext: 'PDF' },
    ];
  }
  const md = inj.date.slice(5).replace('-', '');
  return [
    { name: `初诊病历_${md}.pdf`, ext: 'PDF' },
    { name: `复查影像_${md}.jpg`, ext: 'JPG' },
  ];
}

// ---------- 组件 ----------

interface InjuryDrawerProps {
  injury: Injury | null;
  stage: number;
  /** 非队医 = 脱敏只读 */
  masked: boolean;
  onClose: () => void;
  onAdvanceStage: (injury: Injury, next: number) => void;
}

const GATE_TONE = { green: '#16A34A', amber: '#D97706', red: '#DC2626' } as const;

export default function InjuryDrawer({ injury, stage, masked, onClose, onAdvanceStage }: InjuryDrawerProps) {
  const { toast } = useToast();
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [extraFiles, setExtraFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<number | null>(null); // 0-100
  const [extraNotes, setExtraNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // 切换伤病时重置本地演示状态
  useEffect(() => {
    setExtraFiles([]);
    setExtraNotes([]);
    setNoteDraft('');
    setUploading(null);
    setConfirmAdvance(false);
    setPreview(null);
  }, [injury?.id]);

  const athlete = injury ? getAthlete(injury.athleteId) : undefined;

  const notes = useMemo(() => {
    if (!injury) return [];
    const base: { date: string; text: string }[] = [];
    if (injury.note) base.push({ date: injury.date, text: injury.note });
    if (injury.id === 'INJ01') {
      base.push(
        { date: '2025-06-12', text: '超声复查显示肌纤维愈合良好，进入离心力量阶段。' },
        { date: '2025-06-15', text: '直线跑解禁，无痛全幅度冲刺达成，疼痛评分 1/10。' },
      );
    }
    for (const t of extraNotes) base.push({ date: '2025-06-16', text: t });
    return base;
  }, [injury, extraNotes]);

  if (!injury || !athlete) return null;

  const infos = stageInfos(injury, stage);
  const gates = injury.id === 'INJ01' ? INJ01_GATES : genericGates(stage);
  const remain = daysUntil(injury.estReturn);
  const recovered = injury.status === 'recovered';
  const attachments = [...defaultAttachments(injury), ...extraFiles];
  const canAdvance = !masked && !recovered && stage < 4;

  const startUpload = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
    setUploading(0);
    const started = Date.now();
    const tick = () => {
      const pct = Math.min(100, Math.round(((Date.now() - started) / 1500) * 100));
      setUploading(pct);
      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setExtraFiles((prev) => [...prev, { name: fileName, ext }]);
        setUploading(null);
        toast(`已归档至 ${injury.id}（演示）`);
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <Drawer open={!!injury} onClose={onClose} title="伤病详情" width={560}>
      {/* 脱敏提示 */}
      {masked && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-500/25 bg-brand-50 px-3.5 py-2.5 text-xs text-brand-700">
          <ShieldAlert className="h-4 w-4" />
          脱敏只读视图：诊断保留，医嘱与影像详情已按角色权限打码
        </div>
      )}

      {/* 头部 */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-7 text-text-1">{injury.type}</h2>
        <StatusBadge
          tone={recovered ? 'green' : injury.activeKind === '停训' ? 'red' : injury.activeKind === '限制' ? 'amber' : 'blue'}
          label={recovered ? '已康复' : injury.activeKind === '停训' ? '停训中' : injury.activeKind ?? '活跃'}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-canvas/60 p-3.5">
        <Avatar name={athlete.name} group={athlete.group} size={38} />
        <div className="flex-1 text-xs text-text-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text-1">
            {athlete.name} <AgeBadge group={athlete.group} /> <span className="font-normal text-text-3">{athlete.position}</span>
          </p>
          <p className="mt-0.5">
            主责队医 {injury.doctor} · 伤发 <span className="font-mono-data tnum">{injury.date}</span> · {injury.site}
          </p>
        </div>
        <span className="font-mono-data text-xs text-text-3">{injury.id}</span>
      </div>

      {/* ETA 卡 */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-ok/25 bg-ok-bg/50 px-4 py-3">
        <p className="text-sm text-text-1">
          预计复出 <span className="font-mono-data font-bold tnum">{shortDate(injury.estReturn)}</span>
          {!recovered && remain >= 0 && <span className="ml-2 text-xs text-text-2">剩余 {remain} 天</span>}
        </p>
        <StatusBadge tone="green" label={recovered ? '已复出' : '与计划一致'} pulse={false} />
      </div>

      {/* RTP 康复时间线 */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3>RTP 康复时间线</h3>
          {canAdvance && (
            <button
              onClick={() => setConfirmAdvance(true)}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-btn-brand px-2.5 text-xs font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5" /> 推进到下一阶段
            </button>
          )}
        </div>
        <div className="relative ml-2 border-l-2 border-line pl-6">
          {RTP_STAGES.map((name, i) => {
            const done = i < stage || recovered;
            const current = !recovered && i === stage;
            const info = infos[i];
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="relative pb-5 last:pb-0"
              >
                {/* 节点 */}
                <span
                  className={cn(
                    'absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-card',
                    current && 'ring-4 ring-brand-500/20',
                  )}
                  style={{ background: done ? '#16A34A' : current ? '#2563EB' : '#CBD5E1' }}
                >
                  {current && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand-500 opacity-40 motion-reduce:hidden" />
                  )}
                  {i + 1}
                </span>
                <div className={cn('rounded-xl border p-3', current ? 'border-brand-500/40 bg-brand-50/50' : 'border-line', !done && !current && 'opacity-70')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-1">
                      {['①', '②', '③', '④', '⑤'][i]} {name}
                    </p>
                    <span className="font-mono-data text-[11px] text-text-3 tnum">{info.dateRange}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-2">{info.summary}</p>
                  <p className="mt-1 text-[11px] font-medium" style={{ color: done ? '#16A34A' : current ? '#2563EB' : '#94A3B8' }}>
                    {done ? '✓ 已完成' : current ? '● 当前阶段' : '○ 未开始'}
                  </p>
                  {current && info.progress !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700" style={{ width: `${info.progress}%` }} />
                      </div>
                      <span className="font-mono-data text-[11px] font-semibold text-brand-700 tnum">{info.progress}%</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 复出测试达标卡（活跃伤病） */}
      {!recovered && (
        <div className="mt-5 rounded-xl border border-line p-4">
          <h3 className="mb-3">复出测试达标门槛</h3>
          <div className="flex flex-col gap-2.5">
            {gates.map((g) => (
              <div key={g.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-1">{g.label}</span>
                  <span className="font-mono-data tnum" style={{ color: GATE_TONE[g.tone] }}>{g.current}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${g.pct}%`, background: GATE_TONE[g.tone] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMR / 影像归档 */}
      <div className="mt-5">
        <h3 className="mb-3 flex items-center gap-1.5">
          <Paperclip className="h-4 w-4 text-text-3" /> EMR / 影像归档
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {attachments.map((f, i) => (
            <motion.button
              key={`${f.name}-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              onClick={() => setPreview(f)}
              className="group relative overflow-hidden rounded-xl border border-line text-left transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex h-16 items-center justify-center bg-gradient-to-br from-[#E2E8F0] to-[#C7D2E8]">
                {f.ext === 'PDF' ? <FileText className="h-6 w-6 text-[#64748B]" /> : <ImageIcon className="h-6 w-6 text-[#64748B]" />}
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate font-mono-data text-[11px] text-text-1">{masked ? `████.${f.ext.toLowerCase()}` : f.name}</p>
              </div>
              <span className="absolute right-1.5 top-1.5 rounded bg-[#0F172A]/70 px-1 py-px font-mono-data text-[9px] font-semibold text-white">
                {f.ext}
              </span>
            </motion.button>
          ))}
        </div>

        {/* 上传区（脱敏视图隐藏） */}
        {!masked && (
          <div className="mt-3">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startUpload(f.name);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading !== null}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-5 text-text-3 transition-colors hover:border-brand-500 hover:text-brand-600"
            >
              {uploading !== null ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  <span className="text-xs">上传中…</span>
                  <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[#EEF2F7]">
                    <span className="block h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${uploading}%` }} />
                  </span>
                </>
              ) : (
                <>
                  <FileUp className="h-5 w-5" />
                  <span className="text-xs font-medium">拖拽或点击上传 影像/病历（演示）</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 医嘱与备注 */}
      <div className="mt-5">
        <h3 className="mb-3">医嘱与备注</h3>
        <div className="flex flex-col gap-2.5">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-[10px] font-bold text-white">
                {injury.doctor.charAt(0)}
              </span>
              <div className="flex-1 rounded-xl bg-canvas px-3 py-2">
                <p className="text-[11px] text-text-3">{injury.doctor} · <span className="font-mono-data tnum">{n.date}</span></p>
                <p className="mt-0.5 text-xs leading-5 text-text-1">
                  {masked ? '████ ████████ ████ ██████（脱敏）' : n.text}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!masked && (
          <div className="mt-3 flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="添加医嘱…"
              className="h-9 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand-500"
            />
            <button
              disabled={!noteDraft.trim()}
              onClick={() => {
                setExtraNotes((prev) => [...prev, noteDraft.trim()]);
                setNoteDraft('');
                toast('医嘱已保存（演示）');
              }}
              className="h-9 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              提交
            </button>
          </div>
        )}
      </div>

      {/* 推进确认 Modal */}
      <Modal open={confirmAdvance} onClose={() => setConfirmAdvance(false)} title="推进 RTP 阶段" width={400}>
        <p className="text-sm leading-6 text-text-2">
          确认将 <span className="font-semibold text-text-1">{athlete.name}</span> 从
          「{RTP_STAGES[stage]}」推进至「<span className="font-semibold text-brand-600">{RTP_STAGES[Math.min(stage + 1, 4)]}</span>」？
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setConfirmAdvance(false)}
            className="h-9 flex-1 rounded-lg border border-line text-sm font-medium text-text-2 transition-colors hover:bg-canvas"
          >
            取消
          </button>
          <button
            onClick={() => {
              onAdvanceStage(injury, Math.min(stage + 1, 4));
              setConfirmAdvance(false);
            }}
            className="h-9 flex-1 rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            确认推进
          </button>
        </div>
      </Modal>

      {/* 附件预览 Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="附件预览（占位图）" width={480}>
        {preview && (
          <div>
            <div className="flex h-52 items-center justify-center rounded-xl bg-gradient-to-br from-[#E2E8F0] to-[#C7D2E8]">
              {preview.ext === 'PDF' ? <FileText className="h-12 w-12 text-[#64748B]" /> : <ImageIcon className="h-12 w-12 text-[#64748B]" />}
            </div>
            <div className="mt-3 text-xs leading-6 text-text-2">
              <p>文件名：<span className="font-mono-data text-text-1">{masked ? `████.${preview.ext.toLowerCase()}` : preview.name}</span></p>
              <p>类型：{preview.ext} · 大小：<span className="font-mono-data tnum">{Math.round(200 + seededHash(preview.name) * 3800)} KB</span> · 归档：{injury.id} · 上传人：{injury.doctor}</p>
            </div>
          </div>
        )}
      </Modal>
    </Drawer>
  );
}
