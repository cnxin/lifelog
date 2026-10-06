import { Lunar, LunarMonth, LunarYear, Solar } from "lunar-javascript";
import { MAX_CALENDAR_DATE, MIN_CALENDAR_DATE } from "./calendar";

export function validLunarYear(year: number) {
  return Number.isInteger(year) && year >= 1901 && year <= 2099;
}
export function lunarDays(year: number, month: number) {
  const entry = validLunarYear(year) ? LunarMonth.fromYm(year, month) : null;
  if (!entry) return [];
  return Array.from({ length: entry.getDayCount() }, (_, i) => {
    const lunar = Lunar.fromYmd(year, month, i + 1);
    const date = lunar.getSolar().toYmd();
    return { day: i + 1, date, label: lunar.getDayInChinese(),
      enabled: date >= MIN_CALENDAR_DATE && date <= MAX_CALENDAR_DATE };
  });
}
export function lunarMonths(year: number) {
  if (!validLunarYear(year)) return [];
  const leap = LunarYear.fromYear(year).getLeapMonth();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  if (leap) months.splice(leap, 0, -leap);
  return months.map(month => {
    const first = Lunar.fromYmd(year, month, 1);
    const last = Lunar.fromYmd(year, month, LunarMonth.fromYm(year, month)!.getDayCount());
    return { month, label: first.getMonthInChinese() + "月",
      enabled: first.getSolar().toYmd() <= MAX_CALENDAR_DATE && last.getSolar().toYmd() >= MIN_CALENDAR_DATE };
  });
}
export function lunarCursor(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  if (lunar.getYear() < 1901) return { year: 1901, month: 1, day: 1 };
  return { year: lunar.getYear(), month: lunar.getMonth(), day: lunar.getDay() };
}
