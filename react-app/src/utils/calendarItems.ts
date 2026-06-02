import type { LifeLogState } from "../types";
import { buildPersonAnniversaryPath } from "./anniversaryLinks";
import {
  buildAnniversaryMilestoneDate,
  formatCalendarLunarSummary,
  formatAnniversaryMilestoneLabel,
  normalizeAnniversaryMilestoneCounting,
  normalizeAnniversaryMilestoneDays
} from "./date";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, isManualTitle } from "./memoryDisplay";

export type CalendarItem = {
  id: string;
  dateKey: string;
  title: string;
  subtitle: string;
  subtitleLines?: string[];
  content?: string;
  mood?: string;
  tagItems?: string[];
  type: "person" | "memory";
  target: string;
};

export function buildCalendarMonthDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      dateKey: toCalendarDateKey(date),
      inMonth: date.getMonth() === month
    };
  });
}

export function buildCalendarItemsForDateRange(
  startDateKey: string,
  endDateKey: string,
  state: LifeLogState,
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
): CalendarItem[] {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) return [];

  const peopleItems = state.people.flatMap((person) =>
    person.anniversaries.flatMap((anniversary) => {
      const source = parseDateKey(anniversary.date);
      if (!source) return [];

      const items: CalendarItem[] = [];
      for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
        const eventDate = new Date(year, source.getMonth(), source.getDate());
        const dateKey = toCalendarDateKey(eventDate);
        if (!isDateKeyInRange(dateKey, startDateKey, endDateKey)) continue;

        const summary = formatCalendarLunarSummary(dateKey);
        items.push({
          id: `person-${person.id}-${anniversary.title}-${dateKey}`,
          dateKey,
          title: `${person.name} · ${anniversary.title}`,
          subtitle: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean).join(" · "),
          subtitleLines: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean),
          type: "person",
          target: buildPersonAnniversaryPath(person.id, anniversary)
        });
      }

      const counting = normalizeAnniversaryMilestoneCounting(anniversary.milestoneCounting);
      for (const milestoneDay of normalizeAnniversaryMilestoneDays(anniversary)) {
        const milestoneDate = buildAnniversaryMilestoneDate(anniversary.date, milestoneDay, counting);
        if (!milestoneDate) continue;
        const dateKey = toCalendarDateKey(milestoneDate);
        if (!isDateKeyInRange(dateKey, startDateKey, endDateKey)) continue;
        const summary = formatCalendarLunarSummary(dateKey);
        const milestoneLabel = formatAnniversaryMilestoneLabel(milestoneDay, counting);
        items.push({
          id: `person-${person.id}-${anniversary.title}-milestone-${milestoneDay}-${dateKey}`,
          dateKey,
          title: `${person.name} · ${anniversary.title} ${milestoneLabel}`,
          subtitle: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean).join(" · "),
          subtitleLines: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean),
          type: "person",
          target: buildPersonAnniversaryPath(person.id, anniversary)
        });
      }
      return items;
    })
  );

  const memoryItems = state.memories
    .filter((memory) => isDateKeyInRange(memory.date, startDateKey, endDateKey))
    .map((memory) => {
      const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
      const content = isManualTitle(memory) ? memory.content.trim() : "";
      return {
        id: `memory-${memory.id}`,
        dateKey: memory.date,
        title: getMemoryDisplayTitle(memory, ctx),
        subtitle: [ctx.personNames.join("、"), ctx.placeName].filter(Boolean).join(" · ") || "未关联",
        content,
        mood: memory.mood,
        tagItems: (memory.tags || []).filter(Boolean),
        type: "memory" as const,
        target: `/memories/${memory.id}`
      };
    });

  return [...peopleItems, ...memoryItems].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function groupCalendarItemsByDate(items: CalendarItem[]) {
  return items.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    acc[item.dateKey] = [...(acc[item.dateKey] || []), item];
    return acc;
  }, {});
}

export function toCalendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isDateKeyInRange(dateKey: string, startDateKey: string, endDateKey: string) {
  return dateKey >= startDateKey && dateKey <= endDateKey;
}
