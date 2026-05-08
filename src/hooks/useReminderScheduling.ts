import { useEffect, useState } from "react";
import { useLifeLog } from "../context/LifeLogContext";
import { checkNotificationPermission } from "../utils/notificationPermissions";
import { scheduleAllReminders } from "../utils/reminderScheduler";

const REMINDER_PERMISSION_EVENT = "lifelog:notification-permission-changed";

export function notifyReminderPermissionChanged() {
  window.dispatchEvent(new Event(REMINDER_PERMISSION_EVENT));
}

export function useReminderScheduling() {
  const { state, reminderSettings, isLoading } = useLifeLog();
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshPermission() {
      const granted = await checkNotificationPermission();
      if (active) setHasPermission(granted);
    }

    void refreshPermission();
    window.addEventListener(REMINDER_PERMISSION_EVENT, refreshPermission);
    return () => {
      active = false;
      window.removeEventListener(REMINDER_PERMISSION_EVENT, refreshPermission);
    };
  }, []);

  useEffect(() => {
    if (isLoading || !hasPermission) return;

    const timer = window.setTimeout(() => {
      void scheduleAllReminders(state.people, state.memories, reminderSettings);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [state.people, state.memories, reminderSettings, isLoading, hasPermission]);
}
