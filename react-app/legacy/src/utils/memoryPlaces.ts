import type { MemoryEvent } from "../types";

export function getMemoryPlaceIds(memory: Pick<MemoryEvent, "placeId"> & Partial<Pick<MemoryEvent, "placeIds">>) {
  const placeIds = Array.isArray(memory.placeIds) ? memory.placeIds : [];
  return uniqueIds([...placeIds, memory.placeId]);
}

export function normalizeMemoryPlaceIds(placeIds: string[] = [], legacyPlaceId = "") {
  return uniqueIds([...placeIds, legacyPlaceId]);
}

export function hasMemoryPlace(memory: Pick<MemoryEvent, "placeId"> & Partial<Pick<MemoryEvent, "placeIds">>, placeId: string) {
  return Boolean(placeId) && getMemoryPlaceIds(memory).includes(placeId);
}

export function replaceMemoryPlaceId(
  memory: MemoryEvent,
  fromId: string,
  toId: string
): MemoryEvent {
  const nextPlaceIds = getMemoryPlaceIds(memory).map((placeId) => (placeId === fromId ? toId : placeId));
  const normalized = uniqueIds(nextPlaceIds);
  return {
    ...memory,
    placeId: memory.placeId === fromId ? toId : memory.placeId,
    placeIds: normalized
  };
}

export function removeMemoryPlaceId(memory: MemoryEvent, placeId: string): MemoryEvent {
  const nextPlaceIds = getMemoryPlaceIds(memory).filter((id) => id !== placeId);
  return {
    ...memory,
    placeId: memory.placeId === placeId ? nextPlaceIds[0] || "" : memory.placeId,
    placeIds: nextPlaceIds
  };
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
}
