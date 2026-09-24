/**
 * 运动员花名册 `/athletes`（roster.md §A）
 * FilterBar 筛选 + 24 人表格 + 行点击进档案；支持 ?status=red 联动
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, UserPlus } from 'lucide-react';
import { useToast } from '@/components/common';
import { ATHLETES } from '@/data';
import type { RTPStatus } from '@/data';
import RosterFilterBar from '@/components/roster/RosterFilterBar';
import { EMPTY_FILTER } from '@/components/roster/utils';
import type { RosterFilter } from '@/components/roster/utils';
import RosterTable from '@/components/roster/RosterTable';

export default function Roster() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const statusParam = params.get('status');
  const initialStatus: RTPStatus | 'all' =
    statusParam === 'green' || statusParam === 'amber' || statusParam === 'red' ? statusParam : 'all';

  const [filter, setFilter] = useState<RosterFilter>({ ...EMPTY_FILTER, status: initialStatus });

  const filtered = useMemo(() => {
    const q = filter.query.trim();
    return ATHLETES.filter(
      (a) =>
        (filter.groups.length === 0 || filter.groups.includes(a.group)) &&
        (filter.position === 'all' || a.position === filter.position) &&
        (filter.status === 'all' || a.rtp === filter.status) &&
        (q === '' || a.name.includes(q) || a.id.toLowerCase().includes(q.toLowerCase())),
    );
  }, [filter]);

  return (
    <div>
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>运动员花名册</h1>
          <p className="mt-1 text-sm text-text-2">24 名在训梯队运动员 · U13–U18</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast('已导出 CSV（演示）')}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-text-2 shadow-card transition-all hover:bg-canvas active:scale-[0.97]"
          >
            <Download className="h-4 w-4" />
            导出名单
          </button>
          <button
            onClick={() => toast('演示环境暂不支持新增', 'info')}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-btn-brand px-3.5 text-sm font-semibold text-white transition-all hover:bg-btn-brand-hover active:scale-[0.97]"
          >
            <UserPlus className="h-4 w-4" />
            新建运动员档案
          </button>
        </div>
      </div>

      <RosterFilterBar value={filter} onChange={setFilter} />

      <div className="mt-4">
        {/* key 随筛选变化：重置分页并触发行重排动画 */}
        <RosterTable key={JSON.stringify(filter)} athletes={filtered} />
      </div>
    </div>
  );
}
