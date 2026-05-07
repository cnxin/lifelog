export type ID = string;

export interface Anniversary {
  title: string;
  date: string;
}

export interface PreferenceGroup {
  category: string;
  items: string[];
}

export type PlaceLinkPlatform = "amap" | "meituan" | "dianping" | "douyin" | "custom";

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

export interface MemoryEvent {
  id: ID;
  title: string;
  date: string;
  personIds: ID[];
  placeId: ID;
  mood: string;
  content: string;
  tags: string[];
}

export interface LifeLogState {
  people: Person[];
  places: Place[];
  memories: MemoryEvent[];
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
