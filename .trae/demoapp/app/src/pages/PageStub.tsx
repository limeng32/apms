/**
 * PageStub — 页面占位（脚手架阶段）：页面标题 + 模块说明 + 数据已就绪提示
 * 页面代理实现正式页面时替换对应文件即可
 */

import { Construction } from 'lucide-react';
import { useRole, ACCESS_LABEL } from '@/context/RoleContext';
import type { ModuleKey } from '@/data/roles';

interface PageStubProps {
  module: ModuleKey;
  title: string;
  desc: string;
}

export default function PageStub({ module, title, desc }: PageStubProps) {
  const { access } = useRole();
  const level = access(module);
  return (
    <div>
      <div className="mb-5">
        <h1>{title}</h1>
        <p className="mt-1 text-sm text-text-2">{desc}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line bg-white py-20 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
          <Construction className="h-6 w-6 text-brand-600" />
        </span>
        <p className="mt-4 text-sm font-medium text-text-1">{title} · 页面建设中</p>
        <p className="mt-1 text-xs text-text-3">
          当前角色访问级别：{ACCESS_LABEL[level]} · Mock 数据层已就绪（@/data）
        </p>
      </div>
    </div>
  );
}
