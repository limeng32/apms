/**
 * BodyMap — 人体伤病热力图（medical.md §3.2 右卡）
 * body-map.svg 正/背面剪影 + 伤病部位热点叠加（点大小=例数，色=活跃红/康复绿）
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { ChartCard } from '@/components/common';
import { INJURIES, siteDistribution } from '@/data';

/** 部位 → body-map.svg 坐标（viewBox 400×800；正面 x≈105，背面 x≈295） */
const SITE_COORDS: Record<string, { x: number; y: number }> = {
  右大腿后侧: { x: 312, y: 322 },
  左踝: { x: 72, y: 502 },
  右踝: { x: 130, y: 502 },
  右膝: { x: 121, y: 392 },
  左膝: { x: 89, y: 392 },
  右腹股沟: { x: 116, y: 266 },
  左腹股沟: { x: 94, y: 266 },
  左肩: { x: 76, y: 104 },
  右肩: { x: 134, y: 104 },
  左胫骨: { x: 88, y: 448 },
  腰部: { x: 295, y: 232 },
  左大腿: { x: 89, y: 320 },
  右大腿: { x: 121, y: 320 },
  右手腕: { x: 158, y: 218 },
  左手腕: { x: 52, y: 218 },
  右足跟: { x: 322, y: 508 },
  左足跟: { x: 278, y: 508 },
};

interface Hotspot {
  site: string;
  count: number;
  active: number;
  x: number;
  y: number;
}

export default function BodyMap() {
  const [hover, setHover] = useState<Hotspot | null>(null);

  const hotspots = useMemo<Hotspot[]>(() => {
    const map = new Map<string, Hotspot>();
    for (const inj of INJURIES) {
      const coord = SITE_COORDS[inj.site] ?? { x: 105, y: 200 };
      const cur = map.get(inj.site) ?? { site: inj.site, count: 0, active: 0, ...coord };
      cur.count += 1;
      if (inj.status === 'active') cur.active += 1;
      map.set(inj.site, cur);
    }
    return Array.from(map.values());
  }, []);

  const distribution = useMemo(() => [...siteDistribution()].sort((a, b) => b.count - a.count), []);

  return (
    <ChartCard title="伤病部位分布" subtitle="人体热力图 · 点大小=例数 · 红=活跃 / 绿=已康复" className="lg:col-span-4">
      <div className="relative mx-auto w-full max-w-[240px]">
        <img src="/body-map.svg" alt="人体伤病分布" className="block w-full" />
        {hotspots.map((h, i) => {
          const hasActive = h.active > 0;
          const size = 12 + h.count * 5;
          return (
            <motion.button
              key={h.site}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 400, damping: 20 }}
              onMouseEnter={() => setHover(h)}
              onMouseLeave={() => setHover(null)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-card"
              style={{
                left: `${(h.x / 400) * 100}%`,
                top: `${(h.y / 800) * 100}%`,
                width: size,
                height: size,
                background: hasActive ? 'rgba(220,38,38,0.85)' : 'rgba(22,163,74,0.8)',
              }}
            >
              {hasActive && (
                <span className="absolute inset-0 animate-ping rounded-full bg-risk opacity-40 motion-reduce:hidden" />
              )}
            </motion.button>
          );
        })}
        {/* hover tooltip */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-[#0F172A] px-3 py-1.5 text-xs text-white shadow-lift"
            >
              {hover.site} · <span className="font-mono-data tnum">{hover.count}</span> 例
              {hover.active > 0 && <> · <span className="font-mono-data text-red-300 tnum">{hover.active}</span> 活跃</>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 部位榜 */}
      <div className="mt-4 border-t border-line pt-3">
        {distribution.map((d) => (
          <div key={d.site} className="flex items-center gap-2 py-1 text-xs">
            <span className="w-14 text-text-2">{d.site}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF2F7]">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(d.count / 14) * 100}%` }} />
            </div>
            <span className="w-6 text-right font-mono-data font-medium text-text-1 tnum">{d.count}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-warn-bg/60 px-3 py-2 text-xs leading-5 text-warn">
        发育期骨骺炎 2 例（Osgood ×1 · Sever ×1），已联动发育监控降负荷
      </p>
    </ChartCard>
  );
}
