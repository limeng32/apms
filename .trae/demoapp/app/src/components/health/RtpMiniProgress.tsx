/**
 * RtpMiniProgress — RTP 五段迷你进度条（卡片/表格共用）
 * 已完成段绿色填充，当前段蓝色脉冲，未开始段灰
 */

import { cn } from '@/lib/utils';
import { RTP_STAGES } from '@/data';

interface RtpMiniProgressProps {
  /** 当前阶段 0–4（4 = 完全复出） */
  stage: number;
  showLabel?: boolean;
  className?: string;
}

export default function RtpMiniProgress({ stage, showLabel = true, className }: RtpMiniProgressProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex flex-1 items-center gap-1">
        {RTP_STAGES.map((_, i) => (
          <span
            key={i}
            className={cn('h-1.5 flex-1 rounded-full', i === stage && stage < 4 && 'animate-pulse motion-reduce:animate-none')}
            style={{
              background: i < stage || stage === 4 ? '#16A34A' : i === stage ? '#2563EB' : '#E5E9F0',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="shrink-0 font-mono-data text-[11px] font-medium text-text-2 tnum">
          {stage}/4 {RTP_STAGES[stage]}
        </span>
      )}
    </div>
  );
}
