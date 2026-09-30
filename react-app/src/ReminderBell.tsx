import { Bell } from "lucide-react";
import { hasNativeNotifications } from "./notifications";
import type { Day } from "./domain";

export default function ReminderBell({ day }: { day: Day }) {
  if (!hasNativeNotifications() || !day.reminders?.length) return null;
  return <span className="reminder-bell" role="img" aria-label="已设置提醒">
    <Bell size={14} aria-hidden="true" />
  </span>;
}
