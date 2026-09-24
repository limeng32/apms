/**
 * notifications.ts — 预警通知流
 * 对应 mock-data.md §10
 */

export type NotificationLevel = 'red' | 'amber' | 'green' | 'blue';

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  /** 相对时间文本 */
  time: string;
  /** 跳转路由（可选） */
  link?: string;
  read: boolean;
}

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'N01', level: 'red', title: 'A23 邓皓轩 ACWR 1.62 超危险阈值', time: '10 分钟前', link: '/health', read: false },
  { id: 'N02', level: 'red', title: '周子昂股二头肌拉伤进入体能重建期', time: '2 小时前', link: '/medical', read: false },
  { id: 'N03', level: 'amber', title: 'A09 郑凯文 ACWR 1.41，建议下调本周负荷', time: '3 小时前', link: '/health', read: false },
  { id: 'N04', level: 'amber', title: 'T03 敏捷+绕杆任务完成率 50%，窗口剩余 4 天', time: '5 小时前', link: '/testing', read: true },
  { id: 'N05', level: 'green', title: '全队 30m 冲刺复测已全部完成', time: '昨天', link: '/testing', read: true },
  { id: 'N06', level: 'blue', title: 'U15–U16 月度诊断报告已生成', time: '昨天', link: '/reports', read: true },
];

export function unreadCount(): number {
  return NOTIFICATIONS.filter((n) => !n.read).length;
}
