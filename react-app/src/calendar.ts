import { Solar } from "lunar-javascript";
import { nextOccurrence, type Day } from "./domain";

export const MIN_CALENDAR_DATE = "1901-01-01";
export const MAX_CALENDAR_DATE = "2099-12-31";

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return key(value);
}
export function shiftMonth(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + amount, 0)).getUTCDate();
  return key(new Date(Date.UTC(year, month - 1 + amount, Math.min(day, last))));
}
export function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  // Six rows cover every month; null placeholders keep weekday columns aligned.
  return Array.from({ length: 42 }, (_, index) => {
    const date = shiftDate(first, index - offset);
    return date.startsWith(month) ? date : null;
  });
}
// Adapted from legacy/src/utils/date.ts: preserve its festival/solar-term priority
// without importing the old people, memories or milestone modules.
export function calendarDateInfo(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const festivals = [
    ...new Set(
      [...lunar.getFestivals(), ...lunar.getOtherFestivals()].filter(Boolean),
    ),
  ];
  const term = lunar.getJieQi();
  const first = new Date(Date.UTC(year, 0, 1));
  const elapsed = Math.floor(
    (Date.UTC(year, month - 1, day) - first.getTime()) / 86400000,
  );
  return {
    lunar: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    ganZhi: `${lunar.getYearInGanZhi()}${lunar.getYearShengXiao()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    week: `周${solar.getWeekInChinese()} · 第${Math.floor((elapsed + first.getUTCDay()) / 7) + 1}周`,
    festivals,
    term,
    cellText:
      festivals[0] ||
      term ||
      (lunar.getDay() === 1
        ? lunar.getMonthInChinese() + "月"
        : lunar.getDayInChinese()),
  };
}
export function monthOccurrences(
  days: Day[],
  month: string,
): Map<string, Day[]> {
  const result = new Map<string, Day[]>();
  for (const day of days) {
    // Reuse the same leap-day/lunar recurrence policy as the home screen.
    const occurrence = nextOccurrence(day, `${month}-01`);
    if (!occurrence.startsWith(month)) continue;
    const entries = result.get(occurrence) || [];
    entries.push(day);
    result.set(occurrence, entries);
  }
  for (const entries of result.values()) {
    entries.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        a.title.localeCompare(b.title, "zh-CN") ||
        a.id.localeCompare(b.id),
    );
  }
  return result;
}
