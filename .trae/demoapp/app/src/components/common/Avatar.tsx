/**
 * Avatar — 姓氏首字圆形色块（按年龄组取色，design.md §7）
 * AgeBadge — 年龄组小标签（Mono 12px 描边 pill）
 */

import { cn } from '@/lib/utils';
import { GROUP_COLOR, type AgeGroup } from '@/data/athletes';

interface AvatarProps {
  name: string;
  group?: AgeGroup;
  size?: number;
  className?: string;
}

export function Avatar({ name, group, size = 36, className }: AvatarProps) {
  const bg = group ? GROUP_COLOR[group] : '#2563EB';
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
    >
      {name.charAt(0)}
    </span>
  );
}

export function AgeBadge({ group, className }: { group: AgeGroup; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-1.5 py-px font-mono-data text-xs font-medium', className)}
      style={{ color: GROUP_COLOR[group], borderColor: `${GROUP_COLOR[group]}55`, background: `${GROUP_COLOR[group]}0F` }}
    >
      {group}
    </span>
  );
}
