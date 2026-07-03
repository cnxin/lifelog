import { Solar } from "lunar-javascript";
import type { Anniversary, AnniversaryMilestoneCounting, AnniversaryMilestoneMode, Person } from "../types";

export const ANNIVERSARY_MILESTONE_TEMPLATES: Record<AnniversaryMilestoneMode, { label: string; days: number[] }> = {
  off: { label: "关闭", days: [] },
  couple: { label: "情侣", days: [100, 200, 300, 500, 1000, 2000] },
  baby: { label: "宝宝", days: [30, 100, 365] },
  goal: { label: "目标", days: [7, 21, 30, 50, 100, 365] },
  custom: { label: "自定义", days: [] }
};

export interface AnniversaryMilestoneOccurrence {
  anniversary: Anniversary;
  milestoneDay: number;
  counting: AnniversaryMilestoneCounting;
  label: string;
  date: string;
  targetDate: Date;
  days: number;
}

export interface PersonAnniversaryMilestoneOccurrence extends AnniversaryMilestoneOccurrence {
  personId: string;
  personName: string;
}

export function formatMonthDay(date?: string) {
  if (!date) return "未设置";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric"
  });
}

const WESTERN_ZODIAC_SIGNS = [
  { name: "摩羯座", start: 101 },
  { name: "水瓶座", start: 120 },
  { name: "双鱼座", start: 219 },
  { name: "白羊座", start: 321 },
  { name: "金牛座", start: 420 },
  { name: "双子座", start: 521 },
  { name: "巨蟹座", start: 622 },
  { name: "狮子座", start: 723 },
  { name: "处女座", start: 823 },
  { name: "天秤座", start: 923 },
  { name: "天蝎座", start: 1024 },
  { name: "射手座", start: 1123 },
  { name: "摩羯座", start: 1222 }
];

export function getWesternZodiacSign(date?: string) {
  if (!date) return "";
  const [, month, day] = date.split("-").map(Number);
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return "";

  const monthDay = month * 100 + day;
  let sign = WESTERN_ZODIAC_SIGNS[0].name;
  for (const item of WESTERN_ZODIAC_SIGNS) {
    if (monthDay >= item.start) sign = item.name;
  }
  return sign;
}

export interface BirthdayInfo {
  date: string;
  monthDayText: string;
  ageLabel: string;
  zodiac: string;
  lunarText: string;
  ganZhiText: string;
  profileLines: string[];
  listText: string;
  anniversaryMeta: string;
}

export function buildBirthdayInfo(date?: string, occurrenceDate = new Date()): BirthdayInfo | null {
  const normalized = String(date || "").trim();
  if (!normalized) return null;

  const lunar = getLunarDateInfo(normalized);
  const ageLabel = birthdayAgeLabel(normalized, occurrenceDate);
  const zodiac = getWesternZodiacSign(normalized);
  const profileLines = [
    `公历生日 · ${normalized}`,
    zodiac ? `星座 · ${zodiac}` : "",
    lunar?.lunarText || "农历信息暂不可用",
    lunar?.ganZhiText || ""
  ].filter(Boolean);

  return {
    date: normalized,
    monthDayText: formatMonthDay(normalized),
    ageLabel,
    zodiac,
    lunarText: lunar?.lunarText || "",
    ganZhiText: lunar?.ganZhiText || "",
    profileLines,
    listText: [zodiac, `生日${anniversaryRelativeLabel(normalized)}`, ageLabel].filter(Boolean).join(" · "),
    anniversaryMeta: [ageLabel, zodiac].filter(Boolean).join(" · ")
  };
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

  const next = getNextAnnualOccurrence(date, today);
  return diffDays(today, next);
}

export function formatDaysUntilLabel(days: number) {
  if (days <= 0) return "今天";
  if (days === 1) return "明天";
  return `还有 ${days} 天`;
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

export function anniversaryYearLabel(date: string, occurrenceDate = new Date()) {
  const source = parseLocalDate(date);
  const target = startOfLocalDay(occurrenceDate);
  const years = completedYearsAt(source, target);

  if (years > 0) return `${years} 周年`;
  return sameLocalDate(source, target) ? "首次纪念日" : "未满 1 周年";
}

export function anniversaryOccurrenceLabel(date: string, occurrenceDate: Date) {
  const source = parseLocalDate(date);
  const target = startOfLocalDay(occurrenceDate);
  const years = target.getFullYear() - source.getFullYear();

  if (years <= 0) return "首次纪念日";
  return `${years} 周年`;
}

export function birthdayAgeLabel(date: string, occurrenceDate = new Date()) {
  const age = completedYearsAt(parseLocalDate(date), startOfLocalDay(occurrenceDate));

  if (age <= 0) return "出生第一年";
  return `${age} 岁`;
}

export function birthdayOccurrenceAgeLabel(date: string, occurrenceDate: Date) {
  const source = parseLocalDate(date);
  const target = startOfLocalDay(occurrenceDate);
  const age = target.getFullYear() - source.getFullYear();

  if (age <= 0) return "出生第一年";
  return `${age} 岁`;
}

export function getUpcomingAnniversaries(people: Person[]) {
  return people
    .flatMap((person) =>
      person.anniversaries.flatMap((anniversary: Anniversary) => {
        const deltaDays = anniversaryDeltaDays(anniversary.date);
        const nextOccurrence = getNextAnnualOccurrence(anniversary.date);
        const days = diffDays(startOfLocalDay(new Date()), nextOccurrence);
        const annual = {
          ...anniversary,
          personId: person.id,
          personName: person.name,
          kind: "annual" as const,
          days,
          deltaDays,
          label: formatDaysUntilLabel(days),
          yearLabel: anniversary.title === "生日" ? birthdayOccurrenceAgeLabel(anniversary.date, nextOccurrence) : anniversaryOccurrenceLabel(anniversary.date, nextOccurrence)
        };
        const milestone = buildNextAnniversaryMilestone(anniversary);
        if (!milestone) return [annual];
        return [
          annual,
          {
            ...anniversary,
            personId: person.id,
            personName: person.name,
            kind: "milestone" as const,
            milestoneDay: milestone.milestoneDay,
            milestoneLabel: milestone.label,
            milestoneDate: milestone.date,
            date: milestone.date,
            sourceDate: anniversary.date,
            days: milestone.days,
            deltaDays: milestone.days,
            label: formatDaysUntilLabel(milestone.days),
            yearLabel: milestone.label
          }
        ];
      })
    )
    .sort((a, b) => a.days - b.days || b.deltaDays - a.deltaDays);
}

export function normalizeAnniversaryMilestoneMode(value: unknown): AnniversaryMilestoneMode {
  return isAnniversaryMilestoneMode(value) ? value : "off";
}

export function normalizeAnniversaryMilestoneCounting(value: unknown): AnniversaryMilestoneCounting {
  return value === "ordinal" ? "ordinal" : "elapsed";
}

export function normalizeAnniversaryMilestoneDays(anniversary: Pick<Anniversary, "milestoneMode" | "milestoneDays">) {
  const mode = normalizeAnniversaryMilestoneMode(anniversary.milestoneMode);
  const sourceDays = mode === "custom" ? anniversary.milestoneDays : ANNIVERSARY_MILESTONE_TEMPLATES[mode].days;
  return Array.from(
    new Set(
      (sourceDays || [])
        .map(Number)
        .filter((day) => Number.isInteger(day) && day > 0 && day <= 99999)
    )
  ).sort((a, b) => a - b);
}

export function formatAnniversaryMilestoneLabel(day: number, counting: AnniversaryMilestoneCounting = "elapsed") {
  return counting === "ordinal" ? `第 ${day} 天` : `满 ${day} 天`;
}

export function buildNextAnniversaryMilestone(
  anniversary: Anniversary,
  referenceDate = new Date()
): AnniversaryMilestoneOccurrence | null {
  const source = parseLocalDate(anniversary.date);
  if (Number.isNaN(source.getTime())) return null;
  const reference = startOfLocalDay(referenceDate);
  const counting = normalizeAnniversaryMilestoneCounting(anniversary.milestoneCounting);
  const milestones = normalizeAnniversaryMilestoneDays(anniversary);
  if (!milestones.length) return null;

  for (const milestoneDay of milestones) {
    const target = buildMilestoneTargetDate(source, milestoneDay, counting);
    const days = diffDays(reference, target);
    if (days < 0) continue;
    return {
      anniversary,
      milestoneDay,
      counting,
      label: formatAnniversaryMilestoneLabel(milestoneDay, counting),
      date: formatDateValue(target),
      targetDate: target,
      days
    };
  }

  return null;
}

export function buildAnniversaryMilestoneDate(
  date: string,
  milestoneDay: number,
  counting: AnniversaryMilestoneCounting = "elapsed"
) {
  const source = parseLocalDate(date);
  if (Number.isNaN(source.getTime())) return null;
  return buildMilestoneTargetDate(source, milestoneDay, counting);
}

export function buildUpcomingAnniversaryMilestones(
  people: Person[],
  options: { days?: number; referenceDate?: Date } = {}
): PersonAnniversaryMilestoneOccurrence[] {
  const reference = startOfLocalDay(options.referenceDate || new Date());
  const windowDays = options.days ?? 30;
  const entries: PersonAnniversaryMilestoneOccurrence[] = [];

  for (const person of people) {
    for (const anniversary of person.anniversaries) {
      const source = parseLocalDate(anniversary.date);
      if (Number.isNaN(source.getTime())) continue;
      const counting = normalizeAnniversaryMilestoneCounting(anniversary.milestoneCounting);
      for (const milestoneDay of normalizeAnniversaryMilestoneDays(anniversary)) {
        const target = buildMilestoneTargetDate(source, milestoneDay, counting);
        const days = diffDays(reference, target);
        if (days < 0 || days > windowDays) continue;
        entries.push({
          personId: person.id,
          personName: person.name,
          anniversary,
          milestoneDay,
          counting,
          label: formatAnniversaryMilestoneLabel(milestoneDay, counting),
          date: formatDateValue(target),
          targetDate: target,
          days
        });
      }
    }
  }

  return entries.sort((left, right) => left.days - right.days || left.milestoneDay - right.milestoneDay);
}

export function todayLabel() {
  return new Date().toLocaleDateString("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function getNextAnnualOccurrence(date: string, referenceDate = new Date()) {
  const reference = startOfLocalDay(referenceDate);
  const source = parseLocalDate(date);
  let next = new Date(reference.getFullYear(), source.getMonth(), source.getDate());
  if (next < reference) {
    next = new Date(reference.getFullYear() + 1, source.getMonth(), source.getDate());
  }
  return next;
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function startOfLocalDay(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

function diffDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function buildMilestoneTargetDate(source: Date, milestoneDay: number, counting: AnniversaryMilestoneCounting) {
  const target = startOfLocalDay(source);
  target.setDate(target.getDate() + milestoneDay - (counting === "ordinal" ? 1 : 0));
  return target;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAnniversaryMilestoneMode(value: unknown): value is AnniversaryMilestoneMode {
  return value === "off" || value === "couple" || value === "baby" || value === "goal" || value === "custom";
}

function completedYearsAt(source: Date, target: Date) {
  let years = target.getFullYear() - source.getFullYear();
  const targetMonthDay = target.getMonth() * 100 + target.getDate();
  const sourceMonthDay = source.getMonth() * 100 + source.getDate();
  if (targetMonthDay < sourceMonthDay) years -= 1;
  return years;
}

function sameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
