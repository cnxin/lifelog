import { compareDays, nextOccurrence, validDate, type Day } from "./domain";

export type WidgetDay = Pick<Day, "id" | "title" | "category" | "repeat" | "pinned"> & { nextDate: string };
export type WidgetPayload = { version: 1; updatedAt: string; featured: WidgetDay | null; list: WidgetDay[] };
export function buildWidgetPayload(days: Day[], today: string): WidgetPayload | null {
  if (!validDate(today)) return null;
  const list = [...days].sort((a, b) => compareDays(a, b, today)).slice(0, 3)
    .map(day => ({ id: day.id, title: day.title, category: day.category,
      nextDate: nextOccurrence(day, today), repeat: day.repeat, pinned: day.pinned }));
  // A deterministic ISO date stamp keeps this function pure. The native side
  // counts against its current local date, not elapsed hours since updatedAt.
  return { version: 1, updatedAt: `${today}T00:00:00.000Z`, featured: list[0] ?? null, list };
}
