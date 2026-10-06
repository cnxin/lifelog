import { lunarLabel, nextOccurrence, type Day } from "./domain";

export type CalendarIntentPayload = {
  title: string;
  description: string;
  startDate: string;
  allDay: true;
  rrule?: "FREQ=YEARLY";
};

export function buildCalendarIntentPayload(day: Day, today: string): CalendarIntentPayload {
  const annual = day.repeat === "yearly";
  const lunar = annual && day.calendar === "lunar";
  const description = `${day.note ? day.note + "\n\n" : ""}来自 LifeLog · 日子` +
    (lunar ? `\n农历 ${lunarLabel(day.date).replace(/^农历/, "")} · 每年需重新加入` : "");
  // ACTION_INSERT has no standard reminder extra. Keep the calendar app's defaults.
  return {
    title: day.title,
    description,
    startDate: annual ? nextOccurrence(day, today) : day.date,
    allDay: true,
    ...(annual && !lunar ? { rrule: "FREQ=YEARLY" as const } : {}),
  };
}
