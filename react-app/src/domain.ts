import { Lunar, Solar } from "lunar-javascript";

export const categories = ["纪念日", "生日", "倒数日"] as const;
export type Category = (typeof categories)[number];
export type Day = {
  id: string;
  title: string;
  date: string; // Always a Gregorian reference date, even for lunar recurrence.
  category: Category;
  repeat: "none" | "yearly";
  calendar: "solar" | "lunar";
  note: string;
  pinned: boolean;
  reminders: number[];
};
export const MAX_RECORDS = 10000;
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 1901 &&
    y <= 2099 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
export function dayDiff(from: string, to: string): number {
  // UTC calendar ordinals avoid 23/25-hour DST days, never parse local midnight.
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );
}
function solarOccurrence(source: string, year: number): string {
  const [, m, d] = source.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
const lunarCache = new Map<string, string>();

export function nextOccurrence(day: Day, today = todayKey()): string {
  if (day.repeat === "none" || day.date >= today) return day.date;
  const year = Number(today.slice(0, 4));
  if (day.calendar === "solar") {
    const current = solarOccurrence(day.date, year);
    return current >= today ? current : solarOccurrence(day.date, year + 1);
  }
  const cacheKey = `${day.date}:${today}`;
  const cached = lunarCache.get(cacheKey);
  if (cached) return cached;
  const [y, m, d] = day.date.split("-").map(Number);
  const source = Solar.fromYmd(y, m, d).getLunar();
  // Lunar year may start in the previous Gregorian year. Leap birthdays use
  // the regular month when that leap month doesn't exist; day 30 clamps to 29.
  const candidates: string[] = [];
  for (let targetYear = year - 1; targetYear <= year + 1; targetYear++) {
    let occurrence: string | undefined;
    for (const month of [
      ...new Set([source.getMonth(), Math.abs(source.getMonth())]),
    ]) {
      for (const date of [
        ...new Set([source.getDay(), Math.min(source.getDay(), 29)]),
      ]) {
        try {
          occurrence = Lunar.fromYmd(targetYear, month, date)
            .getSolar()
            .toYmd();
          break;
        } catch {
          /* Invalid leap month or short month. */
        }
      }
      if (occurrence) break;
    }
    if (occurrence && occurrence >= today) candidates.push(occurrence);
  }
  if (!candidates.length) throw new Error("无法计算这个农历日期");
  const next = candidates.sort()[0];
  if (lunarCache.size >= MAX_RECORDS) lunarCache.clear();
  lunarCache.set(cacheKey, next);
  return next;
}
export function lunarLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  return `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}
export function dayStatus(day: Day, today = todayKey()) {
  const next = nextOccurrence(day, today);
  const delta = dayDiff(today, next);
  return {
    next,
    delta,
    count: Math.abs(delta),
    label: delta === 0 ? "就是今天" : delta > 0 ? "还有" : "已经",
    elapsed: Math.max(0, dayDiff(day.date, today)),
  };
}
export function compareDays(a: Day, b: Day, today: string): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const da = dayStatus(a, today).delta,
    db = dayStatus(b, today).delta;
  if (da < 0 !== db < 0) return da < 0 ? 1 : -1;
  return (
    (da >= 0 ? da - db : db - da) ||
    a.title.localeCompare(b.title, "zh-CN") ||
    a.id.localeCompare(b.id)
  );
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validateDay(v: unknown): Day {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    !v.id ||
    v.id.length > 500 ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 80 ||
    !validDate(v.date) ||
    !categories.includes(v.category as Category) ||
    !["none", "yearly"].includes(String(v.repeat)) ||
    !["solar", "lunar"].includes(String(v.calendar)) ||
    typeof v.pinned !== "boolean" ||
    typeof v.note !== "string" ||
    v.note.length > 2000 ||
    (v.calendar === "lunar" && v.repeat !== "yearly") ||
    (v.reminders !== undefined && (!Array.isArray(v.reminders) ||
      Array.from(v.reminders).some(offset => ![0, 1, 3, 7].includes(offset))))
  ) {
    throw new Error(
      "备份中有无效记录，请检查日期、名称和文件格式；没有导入任何数据。",
    );
  }
  return {
    id: v.id,
    title: v.title.trim(),
    date: v.date,
    category: v.category as Category,
    repeat: v.repeat as Day["repeat"],
    calendar: v.calendar as Day["calendar"],
    note: v.note,
    pinned: v.pinned,
    reminders: [...new Set((v.reminders ?? []) as number[])].sort((a, b) => a - b),
  };
}
export function extractLegacy(value: unknown): {
  days: Day[];
  skipped: number;
} {
  const root =
    record(value) && record(value.data)
      ? value.data
      : record(value) && record(value.state)
        ? value.state
        : value;
  if (!record(root) || !Array.isArray(root.people))
    throw new Error("这不是可识别的 LifeLog 备份。");
  const days: Day[] = [];
  let skipped = 0;
  root.people.forEach((person, index) => {
    if (!record(person)) {
      skipped++;
      return;
    }
    const name = typeof person.name === "string" ? person.name : "未命名";
    const id = typeof person.id === "string" ? person.id : String(index);
    const add = (
      title: string,
      date: unknown,
      category: Category,
      key: string,
      lunar = false,
    ) => {
      if (!validDate(date)) {
        skipped++;
        return;
      }
      days.push({
        id: `legacy:${id}:${key}`,
        title: title.slice(0, 80),
        date,
        category,
        repeat: "yearly",
        calendar: lunar ? "lunar" : "solar",
        note: "从旧版 LifeLog 导入",
        pinned: person.favorite === true,
        reminders: [],
      });
    };
    if (person.birthday)
      add(
        `${name}的生日`,
        person.birthday,
        "生日",
        "birthday",
        person.birthdayIsLunar === true,
      );
    if (Array.isArray(person.anniversaries))
      person.anniversaries.forEach((anniversary, i) => {
        if (!record(anniversary) || typeof anniversary.title !== "string") {
          skipped++;
          return;
        }
        add(
          `${name} · ${anniversary.title}`,
          anniversary.date,
          "纪念日",
          `anniversary:${i}`,
        );
      });
  });
  if (days.length > MAX_RECORDS)
    throw new Error("最多支持导入 10,000 个日子。");
  return { days: days.map(validateDay), skipped };
}
export function parseBackup(value: unknown): {
  days: Day[];
  skipped: number;
  legacy: boolean;
} {
  if (record(value) && value.format === "lifelog-days") {
    if (
      value.version !== 1 ||
      !Array.isArray(value.days) ||
      value.days.length > MAX_RECORDS
    )
      throw new Error("备份版本或记录数量不受支持。");
    const days = value.days.map(validateDay);
    if (new Set(days.map((day) => day.id)).size !== days.length)
      throw new Error("备份中有重复 ID，没有导入任何数据。");
    return { days, skipped: 0, legacy: false };
  }
  return { ...extractLegacy(value), legacy: true };
}
export function makeBackup(days: Day[]) {
  return {
    format: "lifelog-days",
    version: 1,
    exportedAt: new Date().toISOString(),
    days: days.map(validateDay),
  };
}
