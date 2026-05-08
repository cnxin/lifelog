import { LocalNotifications } from '@capacitor/local-notifications';
import type { Person, MemoryEvent, ReminderSettings } from '../types';
import { daysUntil, anniversaryYearLabel } from './date';

const REMINDER_WINDOW_DAYS = 30;

/**
 * 调度所有提醒
 */
export async function scheduleAllReminders(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications
      });
    }

    const notifications = [];

    if (settings.birthdayEnabled) {
      notifications.push(...generateBirthdayReminders(people, settings));
    }

    if (settings.anniversaryEnabled) {
      notifications.push(...generateAnniversaryReminders(people, settings));
    }

    if (settings.contactEnabled) {
      notifications.push(...generateContactReminders(people, memories, settings));
    }

    if (settings.memoryEnabled) {
      notifications.push(...generateMemoryReminders(memories, settings));
    }

    if (notifications.length > 0) {
      const limited = notifications.slice(0, 64);
      await LocalNotifications.schedule({ notifications: limited });
      console.log(`已调度 ${limited.length} 个提醒`);
    }
  } catch (error) {
    console.error('调度提醒失败:', error);
  }
}

function generateBirthdayReminders(people: Person[], settings: ReminderSettings) {
  const notifications = [];

  for (const person of people) {
    if (!person.birthday) continue;

    const days = daysUntil(person.birthday);
    const advanceOffset = days - settings.birthdayAdvanceDays;

    if (advanceOffset >= 0 && advanceOffset <= REMINDER_WINDOW_DAYS) {
      notifications.push({
        id: generateId('birthday-advance', person.id),
        title: `${person.name}的生日快到了`,
        body: `还有 ${settings.birthdayAdvanceDays} 天就是 ${person.name} 的生日了，记得准备礼物哦`,
        schedule: { at: getScheduleDate(advanceOffset, settings.birthdayTime) }
      });
    }

    if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
      notifications.push({
        id: generateId('birthday-today', person.id),
        title: `今天是${person.name}的生日 🎂`,
        body: `${anniversaryYearLabel(person.birthday)}，记得送上祝福`,
        schedule: { at: getScheduleDate(days, settings.birthdayTime) }
      });
    }
  }

  return notifications;
}

function generateAnniversaryReminders(people: Person[], settings: ReminderSettings) {
  const notifications = [];

  for (const person of people) {
    for (const anniversary of person.anniversaries) {
      if (anniversary.title === '生日') continue;

      const days = daysUntil(anniversary.date);
      const advanceOffset = days - settings.anniversaryAdvanceDays;

      if (advanceOffset >= 0 && advanceOffset <= REMINDER_WINDOW_DAYS) {
        notifications.push({
          id: generateId('anniversary-advance', person.id, anniversary.title),
          title: `${person.name}的${anniversary.title}快到了`,
          body: `还有 ${settings.anniversaryAdvanceDays} 天`,
          schedule: { at: getScheduleDate(advanceOffset, settings.anniversaryTime) }
        });
      }

      if (days >= 0 && days <= REMINDER_WINDOW_DAYS) {
        notifications.push({
          id: generateId('anniversary-today', person.id, anniversary.title),
          title: `今天是${person.name}的${anniversary.title}`,
          body: anniversaryYearLabel(anniversary.date),
          schedule: { at: getScheduleDate(days, settings.anniversaryTime) }
        });
      }
    }
  }

  return notifications;
}

function generateContactReminders(
  people: Person[],
  memories: MemoryEvent[],
  settings: ReminderSettings
) {
  const notifications = [];
  const now = new Date();

  for (const person of people) {
    const lastMemory = memories
      .filter((memory) => memory.personIds.includes(person.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (!lastMemory) continue;

    const lastContactDate = new Date(`${lastMemory.date}T00:00:00`);
    const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / 86400000);

    if (daysSinceContact >= settings.contactIntervalDays) {
      notifications.push({
        id: generateId('contact', person.id),
        title: `好久没联系${person.name}了`,
        body: `已经 ${daysSinceContact} 天没有互动记录了，找个时间聊聊吧`,
        schedule: { at: getScheduleDate(0, settings.contactTime) }
      });
    }
  }

  return notifications;
}

function generateMemoryReminders(memories: MemoryEvent[], settings: ReminderSettings) {
  const notifications = [];
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
    notifications.push({
      id: generateId('memory', today.toISOString().slice(0, 10)),
      title: `${yearsAgo}年前的今天`,
      body: `你有 ${lastYearMemories.length} 条回忆，点击查看`,
      schedule: { at: getScheduleDate(0, settings.memoryTime) }
    });
  }

  return notifications;
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
