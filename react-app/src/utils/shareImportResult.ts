import type { LifeLogShareImportResult } from "./lifelogShare";

export interface ShareImportViewTarget {
  label: string;
  path: string;
}

export function getShareImportViewTarget(result: LifeLogShareImportResult): ShareImportViewTarget | null {
  const memoryIds = result.createdMemoryIds || [];
  const placeIds = result.createdPlaceIds || [];
  const personIds = result.createdPersonIds || [];

  if (memoryIds.length === 1) return { label: "查看回忆", path: `/memories/${memoryIds[0]}` };
  if (memoryIds.length > 1) return { label: "查看回忆", path: "/memories" };
  if (placeIds.length === 1) return { label: "查看地点", path: `/places/${placeIds[0]}` };
  if (placeIds.length > 1) return { label: "查看地点", path: "/places" };
  if (personIds.length === 1) return { label: "查看人物", path: `/people/${personIds[0]}` };
  if (personIds.length > 1) return { label: "查看人物", path: "/people" };

  return null;
}
