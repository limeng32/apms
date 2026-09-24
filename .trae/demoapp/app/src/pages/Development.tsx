/**
 * /development 青训发育监控 — PHV 与成熟度管理（development.md）
 * RBAC：coach/analyst 全部功能；fitness/doctor 只读（无"生成建议"）
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Baby, Info, Ruler, Sparkles, TrendingUp } from 'lucide-react';
import { Modal, useToast, KpiCard } from '@/components/common';
import { useRole } from '@/context/RoleContext';
import { ATHLETES, inPhvWindow, maturitySummary, PHV_WATCH_IDS, getAthlete, injuriesByAthlete } from '@/data';
import MaturityScatter from '@/components/development/MaturityScatter';
import BioBanding from '@/components/development/BioBanding';
import PhvGantt from '@/components/development/PhvGantt';
import HeightBoard from '@/components/development/HeightBoard';
import GrowthChart from '@/components/development/GrowthChart';

export default function Development() {
  const { role, roleInfo } = useRole();
  const { toast } = useToast();
  const canGenerate = role === 'coach' || role === 'analyst';

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const summary = useMemo(() => maturitySummary(), []);
  const windowCount = inPhvWindow().length;
  const avgOffset = useMemo(
    () => ATHLETES.reduce((s, a) => s + a.maturityOffset, 0) / ATHLETES.length,
    [],
  );
  const avgPredicted = useMemo(
    () => Math.round((ATHLETES.reduce((s, a) => s + a.predictedHeight, 0) / ATHLETES.length) * 10) / 10,
    [],
  );
  const watchNames = PHV_WATCH_IDS.map((id) => getAthlete(id)?.name).filter(Boolean).join(' / ');
  /** 骨骺炎监控（发育相关活跃伤病） */
  const growthInjuries = useMemo(
    () => PHV_WATCH_IDS.flatMap((id) => injuriesByAthlete(id)).concat(injuriesByAthlete('A24'))
      .filter((i) => i.status === 'active' && i.mechanism === '发育相关'),
    [],
  );

  return (
    <div>
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>青训发育监控</h1>
          <p className="mt-1 text-sm text-text-2">基于 Khamis-Roche 模型与成熟度偏移（Maturity Offset）的青训发育评估（演示数据）</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModelOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-medium text-text-2 shadow-card transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            <Info className="h-4 w-4" /> 模型说明
          </button>
          <button
            onClick={() => setMeasureOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-4 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            <Ruler className="h-4 w-4" /> 更新测量数据
          </button>
        </div>
      </div>

      {/* 只读提示 */}
      {!canGenerate && (
        <div className="mb-4 rounded-xl border border-brand-500/25 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
          当前为只读视图（角色：{roleInfo.name}）· 「生成分组建议」仅主教练 / 科研人员可用
        </div>
      )}

      {/* KPI 带 */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="PHV ±1 年窗口内" value={windowCount} unit="人" accent="#8B5CF6" hint={`其中敏感期重点监控 ${PHV_WATCH_IDS.length} 人`} />
        <KpiCard title="平均成熟度偏移" value={avgOffset} decimals={1} unit="岁" accent="#2563EB" hint="负值 = 尚未达到身高增长高峰" />
        <KpiCard title="早熟 / 晚熟" value={summary.early} unit={`/ ${summary.late} 人`} accent="#06B6D4" hint={`正常组 ${summary.onTime} 人`} />
        <KpiCard title="预测成年身高均值" value={avgPredicted} decimals={1} unit="cm" accent="#16A34A" hint={`全队 ${ATHLETES.length} 人`} />
      </div>

      {/* 主区：散点矩阵 + Bio-Banding */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <MaturityScatter hoveredId={hoveredId} onHover={setHoveredId} />
        <BioBanding canGenerate={canGenerate} hoveredId={hoveredId} onHover={setHoveredId} />
      </div>

      {/* PHV 窗口甘特图 */}
      <PhvGantt />

      {/* 底部：身高榜 + 增速追踪 */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <HeightBoard />
        <GrowthChart />
      </div>

      {/* 页尾：发育期训练提醒 */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ReminderCard
          index={0}
          icon={<Sparkles className="h-4 w-4 text-[#8B5CF6]" />}
          color="#8B5CF6"
          title={`PHV 敏感期重点监控 ${PHV_WATCH_IDS.length} 人`}
          desc={`${watchNames}：窗口期优先发展速度/灵敏，控制高负荷力量训练`}
        />
        <ReminderCard
          index={1}
          icon={<Baby className="h-4 w-4 text-warn" />}
          color="#D97706"
          title={`骨骺炎监控 ${growthInjuries.length} 人`}
          desc="林沐阳 Osgood / 冯逸飞 Sever：跳跃与冲刺量减半，联动医疗台账"
        />
        <ReminderCard
          index={2}
          icon={<TrendingUp className="h-4 w-4 text-brand-600" />}
          color="#2563EB"
          title="晚熟组对抗保护"
          desc="建议本周 U13–U14 分组对抗按 Bio-Banding 重新分组"
        />
      </div>

      {/* 更新测量数据 Modal（演示表单） */}
      <Modal open={measureOpen} onClose={() => setMeasureOpen(false)} title="更新测量数据（演示）" width={460}>
        <div className="grid grid-cols-2 gap-3">
          {['身高 (cm)', '体重 (kg)', '坐高 (cm)', '体脂率 (%)'].map((label) => (
            <label key={label} className="block">
              <span className="mb-1 block text-xs text-text-2">{label}</span>
              <input
                type="number"
                placeholder="—"
                className="h-9 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand-500"
              />
            </label>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs leading-5 text-text-3">
          提交后将按 Khamis-Roche 模型重算成熟度偏移与预测成年身高（演示环境不持久化）。
        </p>
        <button
          onClick={() => { toast('测量数据已更新并重算（演示）'); setMeasureOpen(false); }}
          className="mt-4 h-9 w-full rounded-lg bg-btn-brand text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
        >
          提交并重算
        </button>
      </Modal>

      {/* 模型说明 Modal */}
      <Modal open={modelOpen} onClose={() => setModelOpen(false)} title="模型说明" width={560}>
        <div className="flex flex-col gap-4 text-sm leading-6 text-text-2">
          <section>
            <h3 className="text-text-1">PHV（身高增长高峰）</h3>
            <p className="mt-1">
              PHV（Peak Height Velocity）是青春期身高增长速度最快的时间点。PHV 前后 ±1 年被视为
              「敏感期窗口」：神经系统与心肺适应能力提升最快，宜优先发展速度、灵敏与协调性，
              同时因骨骼快速生长需控制大负荷力量训练。
            </p>
          </section>
          <section>
            <h3 className="text-text-1">Khamis-Roche 预测成年身高</h3>
            <p className="mt-1">
              无需骨龄片，仅根据当前身高、体重、坐高与父母身高中位数回归预测成年身高，
              典型误差 ±4cm，适用于 4–17 岁青少年（本页为演示口径数据）。
            </p>
          </section>
          <section>
            <h3 className="text-text-1">成熟度偏移（Maturity Offset）</h3>
            <p className="mt-1">
              成熟度偏移 = 当前年龄 − 预测 PHV 年龄。偏移 &lt; −1 岁为「晚熟」、&gt; +1 岁为「早熟」。
              Bio-Banding 按成熟度而非年龄分组训练，可减小身体差异带来的伤病风险与评估偏差。
            </p>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function ReminderCard({ index, icon, color, title, desc }: { index: number; icon: React.ReactNode; color: string; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08, duration: 0.3, ease: 'easeOut' }}
      className="flex gap-3 rounded-[14px] border border-line bg-white p-4 shadow-card"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: color + '14' }}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold" style={{ color }}>{title}</p>
        <p className="mt-1 text-xs leading-5 text-text-2">{desc}</p>
      </div>
    </motion.div>
  );
}
