import type { LifeLogState, MemoryEvent, Person, Place } from "../types";
import { isRecord } from "./lifelogHelpers";
import { getMemoryPlaceIds } from "./memoryPlaces";

export interface BackupHealthReport {
  status: "ok" | "warning";
  people: number;
  places: number;
  memories: number;
  photoRefs: number;
  issueCount: number;
  issues: string[];
}

export interface BackupImportPreview {
  people: number;
  places: number;
  memories: number;
  photos: number;
  repairedPhotos: number;
  ignoredPhotos: number;
  missingPhotoRefs: number;
  extraPhotoRefs: number;
  exportedAt: string;
  appVersion: string;
  issueCount: number;
  issues: string[];
}

export function buildBackupHealthReport(state: LifeLogState): BackupHealthReport {
  const issues = collectStateIssues(state);
  return {
    status: issues.length ? "warning" : "ok",
    people: state.people.length,
    places: state.places.length,
    memories: state.memories.length,
    photoRefs: countMemoryPhotoRefs(state),
    issueCount: issues.length,
    issues
  };
}

export function buildBackupImportPreview(input: Record<string, unknown>): BackupImportPreview {
  const sourceState = isRecord(input.data) ? input.data : input;
  const people = Array.isArray(sourceState.people) ? sourceState.people : [];
  const places = Array.isArray(sourceState.places) ? sourceState.places : [];
  const memories = Array.isArray(sourceState.memories) ? sourceState.memories : [];
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const photoReport = inspectBackupPhotoLinks(
    memories.map((item) => (isRecord(item) ? item : {})),
    photos.map((item) => (isRecord(item) ? item : {}))
  );

  const stateLike = {
    people: people.map((item) => (isRecord(item) ? item : {})),
    places: places.map((item) => (isRecord(item) ? item : {})),
    memories: memories.map((item) => (isRecord(item) ? item : {}))
  };
  const issues = collectRawStateIssues(stateLike);

  return {
    people: people.length,
    places: places.length,
    memories: memories.length,
    photos: photos.length,
    repairedPhotos: photoReport.repairedPhotos,
    ignoredPhotos: photoReport.ignoredPhotos,
    missingPhotoRefs: photoReport.missingPhotoRefs,
    extraPhotoRefs: photoReport.extraPhotoRefs,
    exportedAt: String(input.exportedAt || ""),
    appVersion: String(input.appVersion || ""),
    issueCount: issues.length + photoReport.issues.length,
    issues: [...issues, ...photoReport.issues]
  };
}

function collectStateIssues(state: LifeLogState) {
  return collectRawStateIssues({
    people: state.people,
    places: state.places,
    memories: state.memories
  });
}

function collectRawStateIssues(state: {
  people: Array<Record<string, unknown> | Person>;
  places: Array<Record<string, unknown> | Place>;
  memories: Array<Record<string, unknown> | MemoryEvent>;
}) {
  const issues: string[] = [];
  const personIds = collectIds(state.people, "人物", issues);
  const placeIds = collectIds(state.places, "地点", issues);
  collectIds(state.memories, "回忆", issues);

  let missingPeopleRefs = 0;
  let missingPlaceRefs = 0;
  for (const memory of state.memories) {
    const rawPersonIds = Array.isArray(memory.personIds) ? memory.personIds : [];
    missingPeopleRefs += rawPersonIds.filter((id) => typeof id === "string" && !personIds.has(id)).length;

    const memoryPlaceIds = getMemoryPlaceIds({
      placeId: typeof memory.placeId === "string" ? memory.placeId : "",
      placeIds: Array.isArray(memory.placeIds) ? memory.placeIds.filter((id): id is string => typeof id === "string") : []
    });
    missingPlaceRefs += memoryPlaceIds.filter((placeId) => !placeIds.has(placeId)).length;
  }

  if (missingPeopleRefs) issues.push(`${missingPeopleRefs} 处回忆关联了不存在的人物`);
  if (missingPlaceRefs) issues.push(`${missingPlaceRefs} 处回忆关联了不存在的地点`);

  return issues;
}

function collectIds(
  items: Array<Record<string, unknown> | Person | Place | MemoryEvent>,
  label: string,
  issues: string[]
) {
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  let missing = 0;

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) {
      missing += 1;
      continue;
    }
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }

  if (missing) issues.push(`${missing} 条${label}记录缺少 ID`);
  if (duplicates.size) issues.push(`${duplicates.size} 个${label} ID 重复`);
  return ids;
}

function countMemoryPhotoRefs(state: LifeLogState) {
  return state.memories.reduce((total, memory) => total + (memory.photos || []).length, 0);
}

function inspectBackupPhotoLinks(memories: Array<Record<string, unknown>>, photos: Array<Record<string, unknown>>) {
  const memoryIds = new Set(memories.map((memory) => (typeof memory.id === "string" ? memory.id : "")).filter(Boolean));
  const photoOwnerById = new Map<string, string>();
  const photoIdsInMemories = new Set<string>();
  let duplicatePhotoRefs = 0;

  memories.forEach((memory) => {
    const memoryId = typeof memory.id === "string" ? memory.id : "";
    const refs = Array.isArray(memory.photos) ? memory.photos : [];
    refs.forEach((photoId) => {
      if (typeof photoId !== "string" || !photoId) return;
      if (photoOwnerById.has(photoId)) duplicatePhotoRefs += 1;
      else if (memoryId) photoOwnerById.set(photoId, memoryId);
      photoIdsInMemories.add(photoId);
    });
  });

  const photoRecordIds = new Set<string>();
  const importablePhotoRecordIds = new Set<string>();
  let repairedPhotos = 0;
  let ignoredPhotos = 0;

  photos.forEach((photo) => {
    const photoId = typeof photo.id === "string" ? photo.id : "";
    const memoryId = typeof photo.memoryId === "string" ? photo.memoryId : "";
    if (photoId) photoRecordIds.add(photoId);
    if (photoId && photoOwnerById.has(photoId)) {
      importablePhotoRecordIds.add(photoId);
      return;
    }
    if (memoryIds.has(memoryId)) {
      if (photoId) importablePhotoRecordIds.add(photoId);
      return;
    }
    ignoredPhotos += 1;
  });

  photos.forEach((photo) => {
    const photoId = typeof photo.id === "string" ? photo.id : "";
    const memoryId = typeof photo.memoryId === "string" ? photo.memoryId : "";
    if (photoId && photoOwnerById.has(photoId) && !memoryIds.has(memoryId)) repairedPhotos += 1;
  });

  const missingPhotoRefs = Array.from(photoIdsInMemories).filter((photoId) => !photoRecordIds.has(photoId)).length;
  const extraPhotoRefs = Array.from(importablePhotoRecordIds).filter((photoId) => !photoIdsInMemories.has(photoId)).length;
  const issues: string[] = [];
  if (repairedPhotos) issues.push(`${repairedPhotos} 张照片的回忆归属将自动修复`);
  if (ignoredPhotos) issues.push(`${ignoredPhotos} 张照片没有可用回忆，将在导入时忽略`);
  if (missingPhotoRefs) issues.push(`${missingPhotoRefs} 个回忆照片引用缺少照片文件`);
  if (extraPhotoRefs) issues.push(`${extraPhotoRefs} 张照片未出现在回忆引用中，将自动补回关联`);
  if (duplicatePhotoRefs) issues.push(`${duplicatePhotoRefs} 个照片引用重复出现在多条回忆中`);

  return {
    repairedPhotos,
    ignoredPhotos,
    missingPhotoRefs,
    extraPhotoRefs,
    issues
  };
}
