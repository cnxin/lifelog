import type { Anniversary, Person } from "../types";

export function formatMonthDay(date?: string) {
  if (!date) return "未设置";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric"
  });
}

export function formatLunarDate(date?: string) {
  if (!date) return "农历未设置";

  try {
    const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric"
    }).format(new Date(`${date}T00:00:00`));
    return `农历${lunar}`;
  } catch {
    return "农历转换不可用";
  }
}

export function formatSolarLunar(date?: string) {
  if (!date) return "未设置";
  return `${formatMonthDay(date)} · ${formatLunarDate(date)}`;
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

export function getUpcomingAnniversaries(people: Person[]) {
  return people
    .flatMap((person) =>
      person.anniversaries.map((anniversary: Anniversary) => {
        const deltaDays = anniversaryDeltaDays(anniversary.date);
        return {
          ...anniversary,
          personName: person.name,
          days: Math.abs(deltaDays),
          deltaDays,
          label: anniversaryRelativeLabel(anniversary.date),
          yearLabel: anniversaryYearLabel(anniversary.date)
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
