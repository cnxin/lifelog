import { normalizeState } from "../db/database";
import type {
  AppSettings,
  LifeLogState,
  Photo,
  PlaceMergeHistoryEntry,
  ReminderSettings,
} from "../types";
import { defaultAppSettings, defaultReminderSettings } from "../types";
import { isRecord } from "./lifelogHelpers";

export interface BackupPhotoRecord {
  id: string;
  memoryId: string;
  originalDataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  capturedAt?: string;
  uploadedAt: string;
  order: number;
}

export interface FullBackupPayload {
  schemaVersion: 3;
  version: 3;
  storage: "indexeddb";
  exportedAt: string;
  appVersion: string;
  data: LifeLogState;
  settings: AppSettings;
  reminderSettings: ReminderSettings;
  placeMergeHistory: PlaceMergeHistoryEntry[];
  photos: BackupPhotoRecord[];
  integrity: {
    people: number;
    places: number;
    memories: number;
    anniversaryPlans?: number;
    photos: number;
  };
}

export async function serializeBackupPhoto(photo: Photo): Promise<BackupPhotoRecord> {
  return {
    id: photo.id,
    memoryId: photo.memoryId,
    originalDataUrl: await blobToDataUrl(photo.originalBlob),
    thumbnailDataUrl: await blobToDataUrl(photo.thumbnailBlob),
    width: photo.width,
    height: photo.height,
    fileSize: photo.fileSize,
    mimeType: photo.mimeType,
    capturedAt: photo.capturedAt,
    uploadedAt: photo.uploadedAt,
    order: photo.order
  };
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("照片备份生成失败，请稍后重试。"));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

export async function normalizeBackupPayload(input: Record<string, unknown>) {
  const sourceState = isRecord(input.data) ? input.data : input;
  if (!isBackupStateLike(sourceState)) {
    throw new Error("备份文件缺少人物、地点或回忆数据，导入已取消。");
  }
  const nextState = normalizeState(sourceState as Partial<LifeLogState>);
  const settings = normalizeAppSettings(input.settings);
  const reminderSettings = normalizeReminderSettings(input.reminderSettings);
  const placeMergeHistory = normalizePlaceMergeHistory(input.placeMergeHistory);
  const photos = await normalizeBackupPhotos(input.photos, nextState);
  const validPhotoIds = new Set(photos.map((photo) => photo.id));
  const safeState: LifeLogState = {
    ...nextState,
    memories: nextState.memories.map((memory) => ({
      ...memory,
      photos: Array.from(
        new Set([
          ...memory.photos.filter((photoId) => validPhotoIds.has(photoId)),
          ...photos.filter((photo) => photo.memoryId === memory.id).map((photo) => photo.id)
        ])
      )
    }))
  };

  validateIntegrity(input.integrity, safeState, photos);

  return {
    state: safeState,
    photos,
    settings,
    reminderSettings,
    placeMergeHistory
  };
}

function isBackupStateLike(value: unknown) {
  if (!isRecord(value)) return false;
  return ["people", "places", "memories"].every((key) => Array.isArray(value[key]));
}

function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return defaultAppSettings;
  const themeStyle = String(value.themeStyle || defaultAppSettings.themeStyle);
  return {
    defaultCity: String(value.defaultCity || defaultAppSettings.defaultCity),
    defaultRelationship: String(value.defaultRelationship || defaultAppSettings.defaultRelationship),
    defaultMood: String(value.defaultMood || defaultAppSettings.defaultMood),
    themeStyle: ["classic", "cream", "mint", "mist"].includes(themeStyle) ? (themeStyle as AppSettings["themeStyle"]) : defaultAppSettings.themeStyle
  };
}

function normalizeReminderSettings(value: unknown): ReminderSettings {
  if (!isRecord(value)) return defaultReminderSettings;
  return {
    birthdayEnabled: Boolean(value.birthdayEnabled ?? defaultReminderSettings.birthdayEnabled),
    birthdayAdvanceDays: Number(value.birthdayAdvanceDays) || defaultReminderSettings.birthdayAdvanceDays,
    birthdayTime: String(value.birthdayTime || defaultReminderSettings.birthdayTime),
    anniversaryEnabled: Boolean(value.anniversaryEnabled ?? defaultReminderSettings.anniversaryEnabled),
    anniversaryAdvanceDays: Number(value.anniversaryAdvanceDays) || defaultReminderSettings.anniversaryAdvanceDays,
    anniversaryTime: String(value.anniversaryTime || defaultReminderSettings.anniversaryTime),
    contactEnabled: Boolean(value.contactEnabled ?? defaultReminderSettings.contactEnabled),
    contactIntervalDays: Number(value.contactIntervalDays) || defaultReminderSettings.contactIntervalDays,
    contactTime: String(value.contactTime || defaultReminderSettings.contactTime),
    memoryEnabled: Boolean(value.memoryEnabled ?? defaultReminderSettings.memoryEnabled),
    memoryTime: String(value.memoryTime || defaultReminderSettings.memoryTime)
  };
}

function normalizePlaceMergeHistory(value: unknown): PlaceMergeHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlaceMergeHistoryEntry => {
    if (!isRecord(item)) return false;
    return typeof item.id === "string" && typeof item.happenedAt === "string" && isRecord(item.snapshot);
  });
}

async function normalizeBackupPhotos(value: unknown, state: LifeLogState): Promise<Photo[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("备份中的照片结构不正确。请检查文件是否完整。");
  const memoryIds = new Set(state.memories.map((memory) => memory.id));
  const photoOwnerById = new Map<string, string>();
  state.memories.forEach((memory) => {
    memory.photos.forEach((photoId) => {
      if (!photoOwnerById.has(photoId)) photoOwnerById.set(photoId, memory.id);
    });
  });
  const result: Photo[] = [];

  for (const item of value) {
    if (!isBackupPhotoRecord(item)) {
      throw new Error("备份中的照片字段不完整，导入已取消。");
    }
    const memoryId = memoryIds.has(item.memoryId) ? item.memoryId : photoOwnerById.get(item.id);
    if (!memoryId) continue;
    result.push({
      id: item.id,
      memoryId,
      originalBlob: await dataUrlToBlob(item.originalDataUrl),
      thumbnailBlob: await dataUrlToBlob(item.thumbnailDataUrl),
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      fileSize: Number(item.fileSize) || 0,
      mimeType: item.mimeType,
      capturedAt: item.capturedAt,
      uploadedAt: item.uploadedAt,
      order: Number(item.order) || 0
    });
  }

  return result;
}

function isBackupPhotoRecord(value: unknown): value is BackupPhotoRecord {
  if (!isRecord(value)) return false;
  return ["id", "memoryId", "originalDataUrl", "thumbnailDataUrl", "mimeType", "uploadedAt"].every((key) => typeof value[key] === "string");
}

function validateIntegrity(value: unknown, state: LifeLogState, photos: Photo[]) {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error("备份完整性信息不正确，导入已取消。");
  const expected = {
    people: state.people.length,
    places: state.places.length,
    memories: state.memories.length,
    anniversaryPlans: state.anniversaryPlans.length,
    photos: photos.length
  };

  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (key === "anniversaryPlans" && value[key] === undefined) continue;
    if (Number(value[key]) !== expected[key]) {
      throw new Error("备份完整性校验失败，导入已取消。请重新导出备份后再试。");
    }
  }
}
