import { Capacitor } from "@capacitor/core";
import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";
import { planReminders } from "./reminders";
import type { Day } from "./domain";

export const hasNativeNotifications = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
let pluginPromise: Promise<LocalNotificationsPlugin> | undefined;
async function nativePlugin() {
  if (!hasNativeNotifications()) return null;
  pluginPromise ??= import("@capacitor/local-notifications")
    .then(module => module.LocalNotifications)
    .catch(error => { pluginPromise = undefined; throw error; });
  return pluginPromise;
}
export async function ensurePermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const plugin = await nativePlugin();
    if (!plugin) return "unavailable";
    let permission = await plugin.checkPermissions();
    if (permission.display === "prompt" || permission.display === "prompt-with-rationale")
      permission = await plugin.requestPermissions();
    return permission.display === "granted" ? "granted" : "denied";
  } catch { return "unavailable"; }
}
export async function checkNotificationPermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const plugin = await nativePlugin();
    if (!plugin) return "unavailable";
    return (await plugin.checkPermissions()).display === "granted" ? "granted" : "denied";
  } catch { return "unavailable"; }
}
export type ExactAlarmPermission = "granted" | "denied" | "unavailable";
let exactPermission: ExactAlarmPermission | undefined;
// Non-prompting. The native plugin reports granted below Android 12 itself.
export async function ensureExactAlarm(): Promise<ExactAlarmPermission> {
  let result: ExactAlarmPermission = "unavailable";
  try {
    const plugin = await nativePlugin();
    if (plugin) result = (await plugin.checkExactNotificationSetting()).exact_alarm === "granted"
      ? "granted" : "denied";
  } catch { /* Keep settings and schedule inexact when a check fails. */ }
  if (result !== exactPermission) {
    exactPermission = result;
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("lifelog-exact-alarm-change", { detail: result }));
  }
  return result;
}
// Called only by the editor's explicit “去开启” button, never by resync.
export async function openExactAlarmSettings(): Promise<ExactAlarmPermission> {
  const plugin = await nativePlugin();
  if (!plugin) return "unavailable";
  await plugin.changeExactNotificationSetting();
  return ensureExactAlarm();
}
let channelPromise: Promise<void> | undefined;
let queue: Promise<void> = Promise.resolve();
export function resync(days: Day[], time: string): Promise<void> {
  if (!hasNativeNotifications()) return Promise.resolve();
  const snapshot = days.map(day => ({ ...day, reminders: [...(day.reminders ?? [])] }));
  const job = queue.catch(() => {}).then(async () => {
    const plugin = await nativePlugin();
    if (!plugin) return;
    const pending = await plugin.getPending();
    if (pending.notifications.length)
      await plugin.cancel({ notifications: pending.notifications.map(({ id }) => ({ id })) });
    // Background resync never prompts. Save settings even while permission is
    // denied; the next active event will schedule after system permission changes.
    if ((await plugin.checkPermissions()).display !== "granted") return;
    channelPromise ??= plugin.createChannel({ id: "days", name: "日子提醒", importance: 3 })
      .catch(error => { channelPromise = undefined; throw error; });
    await channelPromise;
    const plans = planReminders(snapshot, new Date(), time);
    const exact = (await ensureExactAlarm()) === "granted";
    if (plans.length) await plugin.schedule({ notifications: plans.map(plan => ({
      id: plan.id, title: plan.title, body: plan.body, channelId: "days",
      extra: { dayId: plan.dayId }, isExactNotification: exact,
      schedule: { at: new Date(plan.at), allowWhileIdle: false },
    })) });
  });
  queue = job;
  return job;
}
export async function onOpenFromNotification(cb: (dayId: string) => void): Promise<() => void> {
  const plugin = await nativePlugin();
  if (!plugin) return () => {};
  const handle = await plugin.addListener("localNotificationActionPerformed", event => {
    const id: unknown = event.notification.extra?.dayId;
    if (typeof id === "string" && id.length > 0 && id.length <= 500) cb(id);
  });
  return () => { void handle.remove(); };
}
