import type { NotionEntityType, NotionPageMapping, NotionSettings, NotionSyncQueueItem } from "../types";

export type NotionRecordSyncStatus = "off" | "pending" | "syncing" | "failed" | "synced" | "unsynced";

export interface NotionRecordSyncMeta {
  status: NotionRecordSyncStatus;
  label: string;
  detail: string;
  lastError?: string;
}

export function buildNotionPageUrl(pageId: string) {
  const normalized = pageId.trim().replace(/-/g, "");
  return normalized ? `https://www.notion.so/${normalized}` : "";
}

export function findNotionPageUrl({
  entityType,
  entityId,
  mappings
}: {
  entityType: NotionEntityType;
  entityId: string;
  mappings: NotionPageMapping[];
}) {
  const mapping = mappings.find((item) =>
    item.entityType === entityType &&
    item.entityId === entityId &&
    item.notionPageId &&
    !item.lastError
  );
  return buildNotionPageUrl(mapping?.notionPageId || "");
}

export function canSyncNotionRecord(settings: NotionSettings, entityType: NotionEntityType) {
  if (!settings.enabled || !settings.token.trim()) return false;
  if (entityType === "person") return Boolean(settings.peopleDatabaseId);
  if (entityType === "place") return Boolean(settings.placesDatabaseId);
  if (entityType === "memory") return Boolean(settings.memoriesDatabaseId);
  return Boolean(settings.plansDatabaseId);
}

export function getNotionRecordSyncMeta({
  enabled,
  entityType,
  entityId,
  mappings,
  queue
}: {
  enabled: boolean;
  entityType: NotionEntityType;
  entityId: string;
  mappings: NotionPageMapping[];
  queue: NotionSyncQueueItem[];
}): NotionRecordSyncMeta {
  if (!enabled) {
    return {
      status: "off",
      label: "未启用",
      detail: "Notion 同步未启用。"
    };
  }

  const queueItem = queue.find((item) => item.entityType === entityType && item.entityId === entityId);
  if (queueItem?.status === "failed") {
    return {
      status: "failed",
      label: "同步失败",
      detail: queueItem.lastError || "Notion 自动同步失败，可在设置中重试。",
      lastError: queueItem.lastError
    };
  }
  if (queueItem?.status === "syncing") {
    return {
      status: "syncing",
      label: "同步中",
      detail: "正在写入 Notion。"
    };
  }
  if (queueItem?.status === "pending") {
    return {
      status: "pending",
      label: "待同步",
      detail: "已加入 Notion 自动同步队列。"
    };
  }

  const mapping = mappings.find((item) => item.entityType === entityType && item.entityId === entityId);
  if (mapping?.lastError) {
    return {
      status: "failed",
      label: "同步失败",
      detail: mapping.lastError,
      lastError: mapping.lastError
    };
  }
  if (mapping?.notionPageId) {
    return {
      status: "synced",
      label: "已同步",
      detail: mapping.lastSyncedAt ? `上次同步 ${formatShortDateTime(mapping.lastSyncedAt)}` : "已写入 Notion。"
    };
  }

  return {
    status: "unsynced",
    label: "未同步",
    detail: "还没有写入 Notion。"
  };
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
