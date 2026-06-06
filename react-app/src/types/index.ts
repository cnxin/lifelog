export type ID = string;

export type AnniversaryMilestoneMode = "off" | "couple" | "baby" | "goal" | "custom";
export type AnniversaryMilestoneCounting = "elapsed" | "ordinal";

export interface Anniversary {
  title: string;
  date: string;
  milestoneMode?: AnniversaryMilestoneMode;
  milestoneDays?: number[];
  milestoneCounting?: AnniversaryMilestoneCounting;
}

export interface PreferenceGroup {
  category: string;
  items: string[];
}

export type PlaceLinkPlatform =
  | "amap"
  | "meituan"
  | "dianping"
  | "douyin"
  | "xiaohongshu"
  | "baidu"
  | "tencent"
  | "wechat"
  | "official"
  | "custom";

export interface PlaceExternalLink {
  label: string;
  url: string;
  platform: PlaceLinkPlatform;
}

export interface Person {
  id: ID;
  name: string;
  nickname?: string;
  relationship: string;
  birthday?: string;
  birthdayIsLunar?: boolean;
  favorite: boolean;
  preferences: PreferenceGroup[];
  dislikes: PreferenceGroup[];
  anniversaries: Anniversary[];
  notes: string;
}

export interface Place {
  id: ID;
  name: string;
  country: string;
  province: string;
  city: string;
  area: string;
  mall: string;
  storeName: string;
  category: string;
  rating: number;
  address: string;
  latitude?: number;
  longitude?: number;
  mapUrl: string;
  sourceUrl: string;
  platformLinks: PlaceExternalLink[];
  photos: string[];
  desc: string;
  tags: string[];
  favorite: boolean;
}

export interface Photo {
  id: ID;
  memoryId: ID;
  originalBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  capturedAt?: string;
  uploadedAt: string;
  order: number;
}

export interface MemoryEvent {
  id: ID;
  title: string;
  date: string;
  personIds: ID[];
  placeId: ID;
  placeIds: ID[];
  mood: string;
  content: string;
  tags: string[];
  photos: string[];
}

export type AnniversaryPlanStatus = "todo" | "doing" | "done" | "skipped";
export type AnniversaryPlanTargetKind = "annual" | "milestone";

export interface AnniversaryPlanTodo {
  id: ID;
  text: string;
  done: boolean;
}

export interface AnniversaryPlan {
  id: ID;
  personId: ID;
  anniversaryTitle: string;
  anniversaryDate: string;
  occurrenceYear: number;
  targetKind?: AnniversaryPlanTargetKind;
  milestoneDay?: number;
  milestoneLabel?: string;
  targetDate: string;
  status: AnniversaryPlanStatus;
  title: string;
  notes: string;
  budget: string;
  checklist: AnniversaryPlanTodo[];
  placeIds: ID[];
  reminderDaysBefore: number[];
  memoryId?: ID;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDisplayContext {
  personNames: string[];
  placeName: string;
  placeNames: string[];
}

export interface LifeLogState {
  people: Person[];
  places: Place[];
  memories: MemoryEvent[];
  anniversaryPlans: AnniversaryPlan[];
}

export type ThemeStyle = "classic" | "cream" | "mint" | "mist";

export interface AppSettings {
  defaultCity: string;
  defaultRelationship: string;
  defaultMood: string;
  themeStyle: ThemeStyle;
  privacyMode?: boolean;
  hidePhotoThumbnails?: boolean;
}

export const defaultAppSettings: AppSettings = {
  defaultCity: "杭州",
  defaultRelationship: "朋友",
  defaultMood: "开心",
  themeStyle: "classic",
  privacyMode: false,
  hidePhotoThumbnails: false
};

export type NotionAuthMode = "manual-token" | "oauth";
export type NotionConnectionStatus = "idle" | "connected" | "failed";

export interface NotionSettings {
  enabled: boolean;
  mode: NotionAuthMode;
  token: string;
  workspaceName: string;
  workspaceBotName: string;
  parentPageId: string;
  peopleDatabaseId: string;
  placesDatabaseId: string;
  memoriesDatabaseId: string;
  plansDatabaseId: string;
  apiVersion: string;
  lastConnectionTestAt?: string;
  lastConnectionStatus?: NotionConnectionStatus;
  lastConnectionMessage?: string;
  lastFullSyncAt?: string;
}

export const defaultNotionSettings: NotionSettings = {
  enabled: false,
  mode: "manual-token",
  token: "",
  workspaceName: "",
  workspaceBotName: "",
  parentPageId: "",
  peopleDatabaseId: "",
  placesDatabaseId: "",
  memoriesDatabaseId: "",
  plansDatabaseId: "",
  apiVersion: "2022-06-28",
  lastConnectionStatus: "idle",
  lastConnectionMessage: ""
};

export type NotionEntityType = "person" | "place" | "memory" | "anniversaryPlan";
export type NotionSyncTrigger = "manual" | "single" | "retry";
export type NotionSyncHistoryStatus = "success" | "partial" | "failed";
export type NotionSyncQueueStatus = "pending" | "syncing" | "failed";

export interface NotionSyncTypeStats {
  total: number;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface NotionPageMapping {
  id: string;
  entityType: NotionEntityType;
  entityId: ID;
  notionPageId?: string;
  dataSourceId: string;
  lastSyncedAt?: string;
  lastSyncHash?: string;
  lastError?: string;
}

export interface NotionSyncQueueItem {
  id: string;
  entityType: NotionEntityType;
  entityId: ID;
  targetLabel: string;
  status: NotionSyncQueueStatus;
  attempts: number;
  queuedAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface NotionSyncFailedItem {
  id: string;
  entityType: NotionEntityType;
  entityId: ID;
  label: string;
  message: string;
  dataSourceId?: string;
  notionPageId?: string;
}

export interface NotionSyncHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  trigger: NotionSyncTrigger;
  status: NotionSyncHistoryStatus;
  targetLabel?: string;
  total: number;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  byType: Record<NotionEntityType, NotionSyncTypeStats>;
  messages: string[];
  failedItems: NotionSyncFailedItem[];
}

export type EntryType = "person" | "place" | "memory";

export type PlaceDuplicateStrength = "strong" | "weak";

export interface PlaceDuplicateGroup {
  signature: string;
  placeIds: ID[];
  canonicalId: ID;
  reason: string;
  label: string;
  strength: PlaceDuplicateStrength;
}

export interface PlaceMergePreview {
  signature: string;
  reason: string;
  strength: PlaceDuplicateStrength;
  details: string[];
  canonical: Place;
  sources: Place[];
  merged: Place;
}

export type PlaceSaveResolution = "save" | "auto-merge" | "confirm-merge";

export interface PlaceSaveInspection {
  resolution: PlaceSaveResolution;
  draft: Place;
  preview?: PlaceMergePreview;
}

export interface PlaceSaveOptions {
  skipDuplicateCheck?: boolean;
  mergeTargetId?: string;
  mergePreviewOverride?: PlaceMergePreview;
}

export interface PlaceMergeHistoryEntry {
  id: ID;
  happenedAt: string;
  reason: string;
  strength: PlaceDuplicateStrength;
  placeIds: ID[];
  snapshot: LifeLogState;
}

export interface ReminderSettings {
  birthdayEnabled: boolean;
  birthdayAdvanceDays: number;
  birthdayTime: string;

  anniversaryEnabled: boolean;
  anniversaryAdvanceDays: number;
  anniversaryTime: string;

  contactEnabled: boolean;
  contactIntervalDays: number;
  contactTime: string;

  memoryEnabled: boolean;
  memoryTime: string;
}

export const defaultReminderSettings: ReminderSettings = {
  birthdayEnabled: true,
  birthdayAdvanceDays: 7,
  birthdayTime: "09:00",

  anniversaryEnabled: true,
  anniversaryAdvanceDays: 3,
  anniversaryTime: "09:00",

  contactEnabled: true,
  contactIntervalDays: 30,
  contactTime: "20:00",

  memoryEnabled: true,
  memoryTime: "21:00"
};
