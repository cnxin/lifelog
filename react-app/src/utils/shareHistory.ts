export type ShareHistoryDirection = "export" | "import";
export type ShareHistoryMethod = "link" | "file";
export type ShareHistoryStatus = "created" | "imported" | "undone" | "failed";

export interface ShareHistoryCounts {
  people?: number;
  places?: number;
  memories?: number;
  photos?: number;
}

export interface ShareHistoryEntry {
  id: string;
  direction: ShareHistoryDirection;
  method: ShareHistoryMethod;
  status: ShareHistoryStatus;
  title: string;
  summary: string;
  createdAt: string;
  targetPath?: string;
  shareLink?: string;
  counts?: ShareHistoryCounts;
}

const SHARE_HISTORY_KEY = "lifelog:share-history:v1";
const MAX_SHARE_HISTORY = 30;

export function loadShareHistory(): ShareHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHARE_HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isShareHistoryEntry).slice(0, MAX_SHARE_HISTORY);
  } catch {
    return [];
  }
}

export function addShareHistoryEntry(input: Omit<ShareHistoryEntry, "id" | "createdAt"> & { createdAt?: string }) {
  const entry: ShareHistoryEntry = {
    ...input,
    id: `share_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: input.createdAt || new Date().toISOString()
  };
  saveShareHistory([entry, ...loadShareHistory()].slice(0, MAX_SHARE_HISTORY));
  return entry;
}

export function updateShareHistoryEntry(id: string, patch: Partial<ShareHistoryEntry>) {
  const next = loadShareHistory().map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  saveShareHistory(next);
}

export function clearShareHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SHARE_HISTORY_KEY);
}

export function formatShareHistoryCounts(counts: ShareHistoryCounts | undefined) {
  if (!counts) return "";
  return [
    counts.people ? `${counts.people} 个人物` : "",
    counts.places ? `${counts.places} 个地点` : "",
    counts.memories ? `${counts.memories} 条记录` : "",
    counts.photos ? `${counts.photos} 张照片` : ""
  ].filter(Boolean).join(" · ");
}

function saveShareHistory(entries: ShareHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHARE_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_SHARE_HISTORY)));
  } catch {
    // 分享历史是辅助信息，写入失败不影响主流程。
  }
}

function isShareHistoryEntry(value: unknown): value is ShareHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ShareHistoryEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.summary === "string" &&
    typeof item.createdAt === "string" &&
    ["export", "import"].includes(String(item.direction)) &&
    ["link", "file"].includes(String(item.method)) &&
    ["created", "imported", "undone", "failed"].includes(String(item.status))
  );
}
