import { Cake, Heart, Hourglass } from "lucide-react";

export const icons = { 纪念日: Heart, 生日: Cake, 倒数日: Hourglass };
export const tones = { 纪念日: "rose", 生日: "amber", 倒数日: "sage" };
export function formatDate(date: string) {
  return date.replace(/-/g, ".");
}
