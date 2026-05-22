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
    exportedAt: String(input.exportedAt || ""),
    appVersion: String(input.appVersion || ""),
    issueCount: issues.length,
    issues
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
