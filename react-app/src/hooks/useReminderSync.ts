import { useEffect, useState } from "react";
import type { Day } from "../domain";
import { db } from "../storage";
import {
  hasNativeNotifications,
  onOpenFromNotification,
  resync,
} from "../notifications";
import { getReminderTime, REMINDER_TIME_KEY } from "../reminders";
export default function useReminderSync({
  days,
  loaded,
  today,
  load,
  setError,
  setDetailId,
  prepareWidgetUpdate,
}: {
  days: Day[];
  loaded: boolean;
  today: string;
  load: () => Promise<void>;
  setError: (message: string) => void;
  setDetailId: (id: string) => void;
  prepareWidgetUpdate: (days: Day[], today: string) => () => Promise<unknown>;
}) {
  const [nativeSyncTick, setNativeSyncTick] = useState(0);
  useEffect(() => {
    if (!loaded || !hasNativeNotifications()) return;
    const timer = window.setTimeout(() => {
      const updateWidget = prepareWidgetUpdate(days, today);
      void Promise.all([resync(days, getReminderTime()), updateWidget()]).catch(
        () => setError("提醒或桌面小组件暂时未能更新，重新打开应用后将重试。"),
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [days, loaded, nativeSyncTick, today]);

  useEffect(() => {
    if (!hasNativeNotifications()) return;
    const sync = () => setNativeSyncTick((value) => value + 1);
    const storage = (event: StorageEvent) => {
      if (event.key === REMINDER_TIME_KEY) sync();
    };
    window.addEventListener("lifelog-reminder-time-change", sync);
    window.addEventListener("storage", storage);

    let disposed = false;
    const opening = onOpenFromNotification((id) => {
      void db.days
        .get(id)
        .then((day) => {
          if (!disposed && day) setDetailId(day.id);
        })
        .catch(() => {});
    });
    void opening.catch(() => {});
    return () => {
      disposed = true;
      window.removeEventListener("lifelog-reminder-time-change", sync);
      window.removeEventListener("storage", storage);
      void opening.then((remove) => remove()).catch(() => {});
    };
  }, [load]);

  return setNativeSyncTick;
}
