import { dayDiff, todayKey } from "./domain";

export function deletedAgo(deletedAt: string, now = new Date()): string {
  const date = new Date(deletedAt);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const days = dayDiff(todayKey(date), todayKey(now));
  if (days === 1) return "昨天";
  if (days > 1) return `${days} 天前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}
