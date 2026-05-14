import type { MemoryEvent } from "../types";

/** 把回忆按月份分组（用于详情页时间线视图） */
export function groupMemoriesByMonth(memories: MemoryEvent[]) {
  const groups = new Map<string, MemoryEvent[]>();

  memories.forEach((memory) => {
    const month = new Date(`${memory.date}T00:00:00`).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
    });
    groups.set(month, [...(groups.get(month) || []), memory]);
  });

  return Array.from(groups, ([month, grouped]) => ({ month, memories: grouped }));
}

/** 统计相关项目频次并取前 N 个（用于"常出现的人物/地点"） */
export function getTopRelatedItems(
  ids: string[],
  getLabel: (id: string) => string,
  limit = 3,
) {
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));

  return Array.from(counts, ([id, count]) => ({ id, count, label: getLabel(id) }))
    .filter((item) => item.label)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, limit);
}
