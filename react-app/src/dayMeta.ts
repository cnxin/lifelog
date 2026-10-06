import { Cake, Heart, Hourglass } from "lucide-react";
import type { Day, dayStatus } from "./domain";

export const icons = { 纪念日: Heart, 生日: Cake, 倒数日: Hourglass };
export const tones = { 纪念日: "rose", 生日: "amber", 倒数日: "sage" };
export function formatDate(date: string) {
  return date.replace(/-/g, ".");
}

export function yearsLabel(day: Day, status: ReturnType<typeof dayStatus>): string {
  const { years, delta } = status;
  if (day.repeat !== "yearly" || years === null || years <= 0 || delta < 0)
    return "";
  if (day.category === "生日")
    return delta === 0 ? `${years} 岁生日` : `即将 ${years} 岁`;
  if (day.category === "纪念日")
    return delta === 0 ? `${years} 周年` : `即将 ${years} 周年`;
  return `第 ${years} 次`;
}

export function elapsedLabel(day: Day, status: ReturnType<typeof dayStatus>): string | null {
  if (day.repeat !== "yearly" || (status.elapsed === 0 && status.delta > 0)) return null;
  const prefix = day.category === "生日" ? "已陪伴" : day.category === "纪念日" ? "一起走过" : "已过去";
  return `${prefix} ${status.elapsed} 天`;
}
