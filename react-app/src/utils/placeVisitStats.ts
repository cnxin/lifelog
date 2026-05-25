import type { MemoryEvent } from "../types";
import { getMemoryPlaceIds } from "./memoryPlaces";

export interface PlaceVisitStats {
  visitCount: number;
  latestDate: string;
  latestLabel: string;
  topPeople: Array<{ id: string; label: string; count: number }>;
}

export function buildPlaceVisitStats(
  placeId: string,
  memories: MemoryEvent[],
  getPersonName: (id: string) => string
): PlaceVisitStats {
  const relatedMemories = memories
    .filter((memory) => getMemoryPlaceIds(memory).includes(placeId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = relatedMemories[0]?.date || "";

  return {
    visitCount: relatedMemories.length,
    latestDate,
    latestLabel: latestDate ? formatRelativeDate(latestDate) : "还没有到访记录",
    topPeople: getTopPeople(relatedMemories, getPersonName)
  };
}

function getTopPeople(memories: MemoryEvent[], getPersonName: (id: string) => string) {
  const counts = new Map<string, number>();
  memories.forEach((memory) => {
    (memory.personIds || []).forEach((personId) => counts.set(personId, (counts.get(personId) || 0) + 1));
  });

  return Array.from(counts, ([id, count]) => ({ id, count, label: getPersonName(id) }))
    .filter((item) => item.label && item.label !== "未关联人物")
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 3);
}

function formatRelativeDate(date: string) {
  const days = daysBetweenToday(date);
  if (days === 0) return "今天到访";
  if (days === 1) return "昨天到访";
  if (days <= 30) return `${days} 天前`;
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric"
  });
}

function daysBetweenToday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - target.getTime()) / 86400000));
}
