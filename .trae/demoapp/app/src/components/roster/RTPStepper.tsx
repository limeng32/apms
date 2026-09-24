/**
 * RTPStepper — 康复时间线五阶段步骤条（roster.md §B Tab5 / design.md §7）
 * 完成段绿色填充连线，当前段脉冲动画
 */

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { RTP_STAGES } from '@/data';
import { cn } from '@/lib/utils';

interface RTPStepperProps {
  /** 当前 RTP 阶段 0–4（已完成 < stage，进行中 = stage） */
  stage: number;
  /** 是否已完全复出 */
  recovered?: boolean;
  className?: string;
}

export default function RTPStepper({ stage, recovered = false, className }: RTPStepperProps) {
  return (
    <div className={cn('flex items-start', className)}>
      {RTP_STAGES.map((label, i) => {
        const done = recovered || i < stage;
        const current = !recovered && i === stage;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-20 flex-col items-center text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.25 }}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono-data text-xs font-semibold',
                  done && 'border-ok bg-ok text-white',
                  current && 'border-brand-600 bg-brand-50 text-brand-600',
                  !done && !current && 'border-line bg-white text-text-3',
                )}
              >
                {current && (
                  <span className="absolute inset-0 animate-ping rounded-full border-2 border-brand-500 opacity-40 motion-reduce:hidden" />
                )}
                {done ? <Check className="h-4 w-4" /> : i}
              </motion.span>
              <span className={cn('mt-1.5 text-[11px] leading-4', done && 'font-medium text-ok', current && 'font-semibold text-brand-600', !done && !current && 'text-text-3')}>
                {label}
              </span>
              {current && <span className="mt-0.5 rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-medium text-brand-600">进行中</span>}
            </div>
            {i < RTP_STAGES.length - 1 && (
              <div className="mx-1 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-[#EEF2F7]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: done || recovered || i < stage ? '100%' : '0%' }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-ok"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
