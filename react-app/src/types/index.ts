export type ID = string;

export interface Anniversary {
  title: string;
  date: string;
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
