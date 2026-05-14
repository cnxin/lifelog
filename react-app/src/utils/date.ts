import { Solar } from "lunar-javascript";
import type { Anniversary, Person } from "../types";

export function formatMonthDay(date?: string) {
  if (!date) return "未设置";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric"
  });
}

export interface LunarDateInfo {
  fullText: string;
  lunarText: string;
  ganZhiText: string;
  ganZhiZodiacText: string;
  zodiac: string;
  weekText: string;
  weekOfYearText: string;
  cellText: string;
  festivals: string[];
  jieQi: string;
}

export function getLunarDateInfo(date?: string): LunarDateInfo | null {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const jieQi = lunar.getJieQi();
  const festivals = [
    ...lunar.getFestivals(),
    ...lunar.getOtherFestivals()
  ].filter(Boolean);
  const lunarText = `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  const zodiac = lunar.getYearShengXiao();
  const ganZhiText = `${lunar.getYearInGanZhi()}${zodiac}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`;
  const weekText = `周${solar.getWeekInChinese()}`;
  const weekOfYearText = `第${getWeekOfYear(year, month, day)}周`;
  const cellText = festivals[0] || jieQi || lunar.getDayInChinese();

  return {
    fullText: `${ganZhiText} ${weekText} ${weekOfYearText}`,
    lunarText,
    ganZhiText,
    ganZhiZodiacText: ganZhiText,
    zodiac,
    weekText,
    weekOfYearText,
    cellText,
    festivals,
    jieQi
  };
}

export function formatLunarDate(date?: string) {
  const info = getLunarDateInfo(date);
  if (!date) return "农历未设置";
  if (!info) return "农历转换不可用";
  return `${info.fullText} · ${info.lunarText}`;
}

export function formatSolarLunar(date?: string) {
  if (!date) return "未设置";
  return `${formatMonthDay(date)} · ${formatLunarDate(date)}`;
}

export function formatCalendarLunarSummary(date?: string) {
  const info = getLunarDateInfo(date);
  if (!date) return { ganZhiLine: "未设置", weekLine: "", lunarLine: "" };
  if (!info) return { ganZhiLine: "农历转换不可用", weekLine: "", lunarLine: "" };
  return {
    ganZhiLine: info.ganZhiZodiacText,
    weekLine: `${info.weekText} ${info.weekOfYearText}`,
    lunarLine: info.lunarText
  };
}

function getWeekOfYear(year: number, month: number, day: number) {
  const target = new Date(year, month - 1, day);
  const start = new Date(year, 0, 1);
  const days = Math.floor((target.getTime() - start.getTime()) / 86400000);
  return Math.floor((days + start.getDay()) / 7) + 1;
}

export function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const source = new Date(`${date}T00:00:00`);
  let next = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  }

  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function anniversaryDeltaDays(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const source = new Date(`${date}T00:00:00`);
  const currentYearDate = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  return Math.round((currentYearDate.getTime() - today.getTime()) / 86400000);
}

export function anniversaryRelativeLabel(date: string) {
  const delta = anniversaryDeltaDays(date);
  if (delta === 0) return "今天";
  if (delta > 0) return `还有 ${delta} 天`;
  return `已过 ${Math.abs(delta)} 天`;
}

export function anniversaryYearLabel(date: string) {
  const source = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let years = today.getFullYear() - source.getFullYear();
  const thisYearDate = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (thisYearDate > today) years -= 1;

  if (years <= 0) return "第 1 年";
  return `${years} 周年`;
}

export function birthdayAgeLabel(date: string) {
  const source = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let age = today.getFullYear() - source.getFullYear();
  const thisYearBirthday = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (thisYearBirthday > today) age -= 1;

  if (age <= 0) return "出生第一年";
  return `${age} 岁`;
}

export function getUpcomingAnniversaries(people: Person[]) {
  return people
    .flatMap((person) =>
      person.anniversaries.map((anniversary: Anniversary) => {
        const deltaDays = anniversaryDeltaDays(anniversary.date);
        return {
          ...anniversary,
          personId: person.id,
          personName: person.name,
          days: Math.abs(deltaDays),
          deltaDays,
          label: anniversaryRelativeLabel(anniversary.date),
          yearLabel: anniversary.title === "生日" ? birthdayAgeLabel(anniversary.date) : anniversaryYearLabel(anniversary.date)
        };
      })
    )
    .sort((a, b) => a.days - b.days || b.deltaDays - a.deltaDays);
}

export function todayLabel() {
  return new Date().toLocaleDateString("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}
