import { useMemo } from "react";

export type HomeSectionId = "todayQueue" | "smartPrompt" | "flashback" | "monthlySchedule" | "taskQueue" | "homeLibrary";

export interface HomeLayoutInput {
  totalRecords: number;
  todayActionCount: number;
  smartPromptCount: number;
  onThisDayCount: number;
  monthlyScheduleCount: number;
  taskCount: number;
  hasHomeLibrary: boolean;
}

export interface HomeLayout {
  defaultTodayQueueOpen: boolean;
  defaultTaskQueueOpen: boolean;
  defaultHomeLibraryOpen: boolean;
  getSectionOrder: (id: HomeSectionId) => number;
}

export function useHomeLayout({
  totalRecords,
  todayActionCount,
  smartPromptCount,
  onThisDayCount,
  monthlyScheduleCount,
  taskCount,
  hasHomeLibrary
}: HomeLayoutInput): HomeLayout {
  return useMemo(() => {
    const isNewUser = totalRecords < 10;
    const priority = new Map<HomeSectionId, number>();
    let nextPriority = 1;

    if (todayActionCount > 0) priority.set("todayQueue", nextPriority++);
    if (smartPromptCount > 0) priority.set("smartPrompt", nextPriority++);
    if (monthlyScheduleCount > 0) priority.set("monthlySchedule", nextPriority++);
    if (onThisDayCount > 0) priority.set("flashback", nextPriority++);
    if (isNewUser && taskCount > 0) priority.set("taskQueue", nextPriority++);
    if (hasHomeLibrary && totalRecords > 30) priority.set("homeLibrary", nextPriority++);

    (["todayQueue", "smartPrompt", "flashback", "monthlySchedule", "taskQueue", "homeLibrary"] as const).forEach((id) => {
      if (!priority.has(id)) priority.set(id, nextPriority++);
    });

    return {
      defaultTodayQueueOpen: todayActionCount > 0,
      defaultTaskQueueOpen: isNewUser && taskCount > 0,
      defaultHomeLibraryOpen: totalRecords > 30 && hasHomeLibrary,
      getSectionOrder: (id: HomeSectionId) => priority.get(id) || 99
    };
  }, [hasHomeLibrary, monthlyScheduleCount, onThisDayCount, smartPromptCount, taskCount, todayActionCount, totalRecords]);
}
