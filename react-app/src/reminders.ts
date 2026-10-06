import { nextOccurrence, todayKey, validReminderTime, type Day } from "./domain";

export const REMINDER_OFFSETS = [0, 1, 3, 7] as const;
export type ReminderTime = string;
export const REMINDER_TIME_KEY = "lifelog-days:reminder-time";
export function normalizeReminderTime(value: unknown): ReminderTime {
  return validReminderTime(value) ? value : "09:00";
}
export function getReminderTime(): ReminderTime {
  try { return normalizeReminderTime(localStorage.getItem(REMINDER_TIME_KEY)); }
  catch { return "09:00"; }
}
export function setReminderTime(time: ReminderTime) {
  localStorage.setItem(REMINDER_TIME_KEY, normalizeReminderTime(time));
  window.dispatchEvent(new Event("lifelog-reminder-time-change"));
}
export type PlannedReminder = {
  id: number;
  dayId: string;
  at: string;
  title: string;
  body: string;
};
export function reminderId(dayId: string, offset: number): number {
  const index = REMINDER_OFFSETS.indexOf(offset as typeof REMINDER_OFFSETS[number]);
  if (index < 0) throw new Error("不支持的提醒提前天数");
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(dayId)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  const id = (((hash & 0x0fffffff) << 3) | index) >>> 0;
  return id > 0x7fffffff ? id - 0x80000000 : id;
}
export function planReminders(days: Day[], now: Date, time: string): PlannedReminder[] {
  const plans: PlannedReminder[] = [];
  const today = todayKey(now);
  for (const day of days) {
    if (!day.reminders?.length || (day.repeat === "none" && day.date < today)) continue;
    const slot = day.reminderTime ?? normalizeReminderTime(time);
    const [hour, minute] = slot.split(":").map(Number);
    const next = nextOccurrence(day, today);
    const [year, month, date] = next.split("-").map(Number);
    for (const offset of day.reminders) {
      const at = new Date(year, month - 1, date - offset, hour, minute);
      if (at.getTime() < now.getTime()) continue;
      plans.push({ id: reminderId(day.id, offset), dayId: day.id,
        at: `${todayKey(at)}T${slot}`, title: day.title,
        body: offset === 0 ? `「${day.title}」就是今天`
          : `「${day.title}」还有 ${offset} 天 · ${next.replace(/-/g, ".")}` });
    }
  }
  return plans.sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id).slice(0, 64);
}
