import type { MemoryEvent } from "../types";

export type RelationshipTemperature = "new" | "active" | "warm" | "cool";

export interface RelationshipHealth {
  temperature: RelationshipTemperature;
  label: string;
  detail: string;
  daysSinceLast: number | null;
  memoryCount: number;
  latestDate: string;
}

export function buildRelationshipHealth(personId: string, memories: MemoryEvent[]): RelationshipHealth {
  const relatedMemories = memories
    .filter((memory) => (memory.personIds || []).includes(personId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = relatedMemories[0];

  if (!latest) {
    return {
      temperature: "new",
      label: "待建立",
      detail: "还没有共同回忆",
      daysSinceLast: null,
      memoryCount: 0,
      latestDate: ""
    };
  }

  const daysSinceLast = daysBetweenToday(latest.date);
  if (daysSinceLast <= 14) {
    return {
      temperature: "active",
      label: "活跃中",
      detail: daysSinceLast === 0 ? "今天有互动记录" : `${daysSinceLast} 天前互动`,
      daysSinceLast,
      memoryCount: relatedMemories.length,
      latestDate: latest.date
    };
  }

  if (daysSinceLast <= 45) {
    return {
      temperature: "warm",
      label: "温热",
      detail: `${daysSinceLast} 天前互动`,
      daysSinceLast,
      memoryCount: relatedMemories.length,
      latestDate: latest.date
    };
  }

  return {
    temperature: "cool",
    label: "需要联系",
    detail: `${daysSinceLast} 天未记录互动`,
    daysSinceLast,
    memoryCount: relatedMemories.length,
    latestDate: latest.date
  };
}

function daysBetweenToday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - target.getTime()) / 86400000));
}
