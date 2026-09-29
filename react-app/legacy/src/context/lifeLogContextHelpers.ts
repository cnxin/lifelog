import type {
  AnniversaryPlan,
  LifeLogState,
  MemoryEvent,
  NotionSettings,
  NotionSyncHistoryEntry,
  NotionSyncQueueItem,
  NotionSyncTrigger
} from "../types";
import type { NotionSyncSummary, NotionSyncTarget } from "../utils/notionSync";
import { buildPlaceDisplayName } from "../utils/placeMeta";
import { uid } from "../utils/lifelogHelpers";

export function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (!incoming.length) return current;
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => incomingById.get(item.id) || item);
  const missing = incoming.filter((item) => !current.some((currentItem) => currentItem.id === item.id));
  return [...merged, ...missing];
}

export function uniqueNotionTargets(targets: NotionSyncTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.entityType}:${target.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildNotionQueueItemId(target: Pick<NotionSyncTarget, "entityType" | "entityId">) {
  return `${target.entityType}:${target.entityId}`;
}

export function compareNotionQueueItems(left: NotionSyncQueueItem, right: NotionSyncQueueItem) {
  const statusRank = (item: NotionSyncQueueItem) => item.status === "failed" ? 0 : item.status === "pending" ? 1 : 2;
  return statusRank(left) - statusRank(right) || left.updatedAt.localeCompare(right.updatedAt);
}

export function mergeNotionQueueItems(current: NotionSyncQueueItem[], incoming: NotionSyncQueueItem[]) {
  if (!incoming.length) return current;
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => incomingById.get(item.id) || item);
  const missing = incoming.filter((item) => !current.some((currentItem) => currentItem.id === item.id));
  return [...merged, ...missing].sort(compareNotionQueueItems);
}

export function formatNotionTargetLabel(target: NotionSyncTarget, state: LifeLogState) {
  if (target.entityType === "person") {
    const person = state.people.find((item) => item.id === target.entityId);
    return `人物：${person?.name || "未命名"}`;
  }
  if (target.entityType === "place") {
    const place = state.places.find((item) => item.id === target.entityId);
    return `地点：${place ? buildPlaceDisplayName(place) : "未命名"}`;
  }
  if (target.entityType === "memory") {
    const memory = state.memories.find((item) => item.id === target.entityId);
    return `回忆：${memory?.title || memory?.date || "未命名"}`;
  }
  const plan = state.anniversaryPlans.find((item) => item.id === target.entityId);
  return `安排：${plan?.title || plan?.anniversaryTitle || "未命名"}`;
}

export function upsertById<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next];
}

export function canAutoSyncNotionTarget(settings: NotionSettings, entityType: NotionSyncTarget["entityType"]) {
  if (!settings.enabled || !settings.token.trim()) return false;
  if (entityType === "person") return Boolean(settings.peopleDatabaseId);
  if (entityType === "place") return Boolean(settings.placesDatabaseId);
  if (entityType === "memory") return Boolean(settings.memoriesDatabaseId);
  return Boolean(settings.plansDatabaseId);
}

export function buildNotionSyncHistoryEntry({
  result,
  startedAt,
  finishedAt,
  trigger,
  targetLabel
}: {
  result: NotionSyncSummary;
  startedAt: string;
  finishedAt: string;
  trigger: NotionSyncTrigger;
  targetLabel?: string;
}): NotionSyncHistoryEntry {
  return {
    id: uid("notion-sync"),
    startedAt,
    finishedAt,
    trigger,
    status: result.failed ? (result.synced || result.skipped ? "partial" : "failed") : "success",
    targetLabel,
    total: result.total,
    synced: result.synced,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
    byType: result.byType,
    messages: result.messages.slice(0, 8),
    failedItems: result.failedItems.slice(0, 20)
  };
}

export function restoreMemoryList(current: MemoryEvent[], snapshots: MemoryEvent[]) {
  if (!snapshots.length) return current;
  const snapshotIds = new Set(snapshots.map((memory) => memory.id));
  const snapshotById = new Map(snapshots.map((memory) => [memory.id, memory]));
  const restored = current.map((memory) => snapshotById.get(memory.id) || memory);
  const missing = snapshots.filter((memory) => !current.some((item) => item.id === memory.id));
  return [...restored.filter((memory) => !snapshotIds.has(memory.id) || snapshotById.has(memory.id)), ...missing];
}

export function restorePlanList(current: AnniversaryPlan[], snapshots: AnniversaryPlan[]) {
  if (!snapshots.length) return current;
  const snapshotById = new Map(snapshots.map((plan) => [plan.id, plan]));
  const restored = current.map((plan) => snapshotById.get(plan.id) || plan);
  const missing = snapshots.filter((plan) => !current.some((item) => item.id === plan.id));
  return [...restored, ...missing];
}

