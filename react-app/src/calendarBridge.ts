import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CalendarIntentPayload } from "./calendarIntent";

export const hasNativeCalendar = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const CalendarBridge = registerPlugin<{
  insert(options: CalendarIntentPayload & { reminderMinutes?: number }): Promise<
    { ok: true } | { ok: false; reason: "no-calendar-app" }
  >;
}>("CalendarBridge");
