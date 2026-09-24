/**
 * Layout — App 骨架：Sidebar + Header + 内容插槽（嵌套路由 <Outlet/> 模式）
 * 内容区 max-width 1560px 居中，padding 24px
 * <1024px 侧边栏自动折叠为图标轨
 */

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

const COLLAPSE_QUERY = '(max-width: 1023px)';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COLLAPSE_QUERY).matches,
  );
  const location = useLocation();

  useEffect(() => {
    const mq = window.matchMedia(COLLAPSE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div
        className="flex min-h-[100dvh] flex-col transition-[padding-left] duration-200 ease-in-out"
        style={{ paddingLeft: collapsed ? 72 : 248 }}
      >
        <Header />
        <main className="flex-1">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="mx-auto max-w-[1560px] p-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
