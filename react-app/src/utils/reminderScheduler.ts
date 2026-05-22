import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Person, MemoryEvent, ReminderSettings } from '../types';
import { daysUntil, anniversaryYearLabel, birthdayAgeLabel } from './date';

const REMINDER_WINDOW_DAYS = 30;
const MAX_PENDING_REMINDERS = 64;

export interface ReminderScheduleSummary {
  totalGenerated: number;
  scheduledCount: number;
  capped: boolean;
  nextAt: Date | null;
  enabledTypes: string[];
  error?: string;
}

export type ReminderPreviewType = "生日" | "纪念日" | "联系" | "回忆";

export interface ReminderPreviewItem {
  id: number;
  type: ReminderPreviewType;
  title: string;
  body: string;
  at: Date;
}

interface ReminderEntry {
  type: ReminderPreviewType;
  notification: LocalNotificationSchema;
}

/**
 * 调度所有提醒
 */
export async function scheduleAllReminders(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
): Promise<ReminderScheduleSummary> {
  const preview = previewReminderSchedule(people, memories, settings);

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications
      });
    }

    const notifications = generateReminderNotifications(people, memories, settings);

    if (notifications.length > 0) {
      const limited = notifications.slice(0, MAX_PENDING_REMINDERS);
      await LocalNotifications.schedule({ notifications: limited });
      console.log(`已调度 ${limited.length} 个提醒`);
    }

    return preview;
  } catch (error) {
    console.error('调度提醒失败:', error);
    return {
      ...preview,
      error: error instanceof Error ? error.message : '调度提醒失败'
    };
  }
}

export function previewReminderSchedule(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
): ReminderScheduleSummary {
  const notifications = generateReminderEntries(people, memories, settings).map((entry) => entry.notification);
  const scheduled = notifications.slice(0, MAX_PENDING_REMINDERS);
  return {
    totalGenerated: notifications.length,
    scheduledCount: scheduled.length,
    capped: notifications.length > MAX_PENDING_REMINDERS,
    nextAt: getNextReminderDate(scheduled),
    enabledTypes: getEnabledReminderTypes(settings)
  };
}

export function previewUpcomingReminders(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings,
  options: { days?: number; limit?: number } = {}
): ReminderPreviewItem[] {
  const days = options.days ?? 7;
  const limit = options.limit ?? 6;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return generateReminderEntries(people, memories, settings)
    .map(({ type, notification }) => ({
      id: notification.id,
      type,
      title: notification.title,
      body: notification.body || "",
      at: notification.schedule?.at || new Date(0)
    }))
    .filter((item) => item.at >= start && item.at <= end)
    .slice(0, limit);
}

function generateReminderNotifications(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
): LocalNotificationSchema[] {
  return generateReminderEntries(people, memories, settings).map((entry) => entry.notification);
}

function generateReminderEntries(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
): ReminderEntry[] {
  const entries: ReminderEntry[] = [];

  if (settings.birthdayEnabled) {
    entries.push(...generateBirthdayReminders(people, settings));
  }

  if (settings.anniversaryEnabled) {
    entries.push(...generateAnniversaryReminders(people, settings));
  }

  if (settings.contactEnabled) {
    entries.push(...generateContactReminders(people, memories, settings));
  }

  if (settings.memoryEnabled) {
    entries.push(...generateMemoryReminders(memories, settings));
  }

  return entries.sort((a, b) => getNotificationTime(a.notification) - getNotificationTime(b.notification));
}

function generateBirthdayReminders(people: Person[], settings: ReminderSettings): ReminderEntry[] {
  const entries: ReminderEntry[] = [];

  for (const person of people) {
    if (!person.birthday) continue;

    const days = daysUntil(person.birthday);
    const advanceOffset = days - settings.birthdayAdvanceDays;

      if (advanceOffset >= 0 && advanceOffset <= REMINDER_WINDOW_DAYS) {
      entries.push({
        type: "生日",
        notification: {
          id: generateId('birthday-advance', person.id),
          title: `${person.name}的生日快到了`,
          body: `还有 ${settings.birthdayAdvanceDays} 天就是 ${person.name} 的生日了，记得准备礼物哦`,
          schedule: { at: getScheduleDate(advanceOffset, settings.birthdayTime) }
        }
      });
    }

    if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
      entries.push({
        type: "生日",
        notification: {
          id: generateId('birthday-today', person.id),
          title: `今天是${person.name}的生日 🎂`,
          body: `${birthdayAgeLabel(person.birthday)}，记得送上祝福`,
          schedule: { at: getScheduleDate(days, settings.birthdayTime) }
        }
      });
    }
  }

  return entries;
}

function generateAnniversaryReminders(people: Person[], settings: ReminderSettings): ReminderEntry[] {
  const entries: ReminderEntry[] = [];

  for (const person of people) {
    for (const anniversary of person.anniversaries) {
      if (anniversary.title === '生日') continue;

      const days = daysUntil(anniversary.date);
      const advanceOffset = days - settings.anniversaryAdvanceDays;

    if (advanceOffset >= 0 && advanceOffset <= REMINDER_WINDOW_DAYS) {
        entries.push({
          type: "纪念日",
          notification: {
            id: generateId('anniversary-advance', person.id, anniversary.title),
            title: `${person.name}的${anniversary.title}快到了`,
            body: `还有 ${settings.anniversaryAdvanceDays} 天`,
            schedule: { at: getScheduleDate(advanceOffset, settings.anniversaryTime) }
          }
        });
      }

      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        entries.push({
          type: "纪念日",
          notification: {
            id: generateId('anniversary-today', person.id, anniversary.title),
            title: `今天是${person.name}的${anniversary.title}`,
            body: anniversaryYearLabel(anniversary.date),
            schedule: { at: getScheduleDate(days, settings.anniversaryTime) }
          }
        });
      }
    }
  }

  return entries;
}

function generateContactReminders(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
) {
  const entries: ReminderEntry[] = [];
  const now = new Date();

  for (const person of people) {
    const lastMemory = memories
      .filter((memory) => (memory.personIds || []).includes(person.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (!lastMemory) continue;

    const lastContactDate = new Date(`${lastMemory.date}T00:00:00`);
    const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / 86400000);

    if (daysSinceContact >= settings.contactIntervalDays) {
      entries.push({
        type: "联系",
        notification: {
          id: generateId('contact', person.id),
          title: `好久没联系${person.name}了`,
          body: `已经 ${daysSinceContact} 天没有互动记录了，找个时间聊聊吧`,
          schedule: { at: getScheduleDate(0, settings.contactTime) }
        }
      });
    }
  }

  return entries;
}

function generateMemoryReminders(memories: MemoryEvent[], settings: ReminderSettings): ReminderEntry[] {
  const entries: ReminderEntry[] = [];
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const lastYearMemories = memories.filter((memory) => {
    const memoryDate = new Date(`${memory.date}T00:00:00`);
    return (
      memoryDate.getMonth() + 1 === month &&
      memoryDate.getDate() === day &&
      memoryDate.getFullYear() < today.getFullYear()
    );
  });

  if (lastYearMemories.length > 0) {
    const yearsAgo = today.getFullYear() - new Date(`${lastYearMemories[0].date}T00:00:00`).getFullYear();
    entries.push({
      type: "回忆",
      notification: {
        id: generateId('memory', today.toISOString().slice(0, 10)),
        title: `${yearsAgo}年前的今天`,
        body: `你有 ${lastYearMemories.length} 条回忆，点击查看`,
        schedule: { at: getScheduleDate(0, settings.memoryTime) }
      }
    });
  }

  return entries;
}

function generateId(type: string, ...parts: string[]): number {
  const str = [type, ...parts].join('-');
  return Math.abs(hashCode(str));
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getScheduleDate(daysFromNow: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getNotificationTime(notification: LocalNotificationSchema) {
  return notification.schedule?.at?.getTime() || Number.MAX_SAFE_INTEGER;
}

function getNextReminderDate(notifications: LocalNotificationSchema[]) {
  const next = notifications
    .map((notification) => notification.schedule?.at)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return next || null;
}

function getEnabledReminderTypes(settings: ReminderSettings) {
  return [
    settings.birthdayEnabled && "生日",
    settings.anniversaryEnabled && "纪念日",
    settings.contactEnabled && "联系",
    settings.memoryEnabled && "回忆"
  ].filter((item): item is string => Boolean(item));
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: 999999,
        title: '测试通知',
        body: '提醒功能正常工作 ✓',
        schedule: { at: new Date(Date.now() + 3000) }
      }]
    });
    return true;
  } catch (error) {
    console.error('发送测试通知失败:', error);
    return false;
  }
}
