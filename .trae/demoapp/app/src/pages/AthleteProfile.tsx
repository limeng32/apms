/**
 * 运动员 360° 数字档案 `/athletes/:id`（roster.md §B）
 * 头部信息卡 + 5 Tab（队医角色仅 3 Tab）；Tab 下划线 layoutId 滑动
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { getAthlete } from '@/data';
import { EmptyState } from '@/components/common';
import ProfileHeader from '@/components/roster/ProfileHeader';
import OverviewTab from '@/components/roster/OverviewTab';
import GrowthTab from '@/components/roster/GrowthTab';
import ResultsTab from '@/components/roster/ResultsTab';
import SkillsTab from '@/components/roster/SkillsTab';
import MedicalTab from '@/components/roster/MedicalTab';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'growth' | 'results' | 'skills' | 'medical';

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'growth', label: '体态与成长' },
  { key: 'results', label: '体测成绩' },
  { key: 'skills', label: '专项技能诊断' },
  { key: 'medical', label: '医疗康复' },
];

export default function AthleteProfile() {
  const { id } = useParams();
  const { role } = useRole();
  const athlete = id ? getAthlete(id) : undefined;

  // 队医角色：仅 概览 / 体态与成长 / 医疗康复（演示菜单差异）
  const tabs = useMemo(
    () => (role === 'doctor' ? ALL_TABS.filter((t) => ['overview', 'growth', 'medical'].includes(t.key)) : ALL_TABS),
    [role],
  );
  const [tab, setTab] = useState<TabKey>('overview');
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'overview';

  if (!athlete) {
    return (
      <div className="rounded-[14px] border border-line bg-white shadow-card">
        <EmptyState
          title="未找到该运动员"
          desc={`编号 ${id ?? ''} 不在花名册中`}
          actionLabel="返回花名册"
          onAction={() => window.history.back()}
        />
      </div>
    );
  }

  return (
    <div>
      {/* 返回 + 面包屑辅助 */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-3">
        <Link to="/athletes" className="flex items-center gap-1 transition-colors hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" />
          运动员
        </Link>
        <span>/</span>
        <span className="text-text-1">{athlete.name}</span>
      </div>

      <ProfileHeader athlete={athlete} />

      {/* Tab 栏（sticky 于头部卡下方） */}
      <div className="sticky top-16 z-20 -mx-1 mt-5 border-b border-line bg-canvas/95 px-1 backdrop-blur">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-4 py-3 text-sm transition-colors',
                activeTab === t.key ? 'font-semibold text-brand-600' : 'text-text-2 hover:text-text-1',
              )}
            >
              {t.label}
              {activeTab === t.key && (
                <motion.span
                  layoutId="profile-tab-underline"
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && <OverviewTab athlete={athlete} />}
            {activeTab === 'growth' && <GrowthTab athlete={athlete} />}
            {activeTab === 'results' && <ResultsTab athlete={athlete} />}
            {activeTab === 'skills' && <SkillsTab athlete={athlete} />}
            {activeTab === 'medical' && <MedicalTab athlete={athlete} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
