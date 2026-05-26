import type {
  Anniversary,
  AppSettings,
  LifeLogState,
  MemoryEvent,
  Place,
  PlaceMergeHistoryEntry,
  PlaceMergePreview,
} from "../types";
import { mergeMemoryPlaceReferences } from "./placeDedup";
import { parsePlatformLinksText } from "./placeLinks";
import { inferMallName, inferProvince, isMallRecord, normalizeCityName, normalizePlaceText } from "./placeMeta";
import { buildMemoryTitle, inferQuickMemory } from "./memoryInference";
import { getMemoryPlaceIds, normalizeMemoryPlaceIds } from "./memoryPlaces";
import { splitLines, splitList } from "./text";

export function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildDate(
  yearValue: FormDataEntryValue | null,
  monthValue: FormDataEntryValue | null,
  dayValue: FormDataEntryValue | null
) {
  const rawYear = String(yearValue || "").trim();
  const rawMonth = String(monthValue || "").trim();
  const rawDay = String(dayValue || "").trim();
  if (!rawYear || !rawMonth || !rawDay) return "";

  const year = rawYear.padStart(4, "0");
  const month = rawMonth.padStart(2, "0");
  const day = rawDay.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseAnniversaries(value: FormDataEntryValue | null): Anniversary[] {
  const raw = String(value || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Array<Partial<Anniversary>>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        title: String(item.title || "").trim(),
        date: String(item.date || "").trim()
      }))
      .filter((item) => item.title && isDateValue(item.date));
  } catch {
    return [];
  }
}

export function mergeBirthdayAnniversary(birthday: string, anniversaries: Anniversary[]) {
  const custom = anniversaries.filter((item) => item.title !== "生日");
  if (!birthday) return custom;
  return [{ title: "生日", date: birthday }, ...custom];
}

export function buildPlaceFromFormData(formData: FormData, id: string | undefined, settings: AppSettings): Place {
  const isEditing = Boolean(id);
  const country = normalizePlaceText(formData.get("country")) || "中国";
  const province = normalizePlaceText(formData.get("province"));
  const city = normalizeCityName(normalizePlaceText(formData.get("city")) || (isEditing ? "" : settings.defaultCity));
  const address = normalizePlaceText(formData.get("address"));
  const category = String(formData.get("category") || "其他");
  const name = String(formData.get("name") || "未命名地点");
  const inferredMall = !isEditing ? inferMallName(address) || (isMallRecord({ name, category }) ? name : "") : "";
  const mall = normalizePlaceText(formData.get("mall")) || inferredMall;
  const rawRating = String(formData.get("rating") ?? "").trim();

  return {
    id: id || uid("l"),
    name,
    country,
    province: isEditing
      ? province
      : inferProvince({
          country,
          province,
          city,
          address
        }),
    city,
    area: String(formData.get("area") || ""),
    mall,
    storeName: String(formData.get("storeName") || ""),
    category,
    rating: parseRating(rawRating),
    address,
    latitude: parseOptionalNumber(formData.get("latitude")),
    longitude: parseOptionalNumber(formData.get("longitude")),
    mapUrl: String(formData.get("mapUrl") || ""),
    sourceUrl: String(formData.get("sourceUrl") || ""),
    platformLinks: parsePlatformLinksText(formData.get("platformLinks")),
    photos: splitLines(formData.get("photos")),
    desc: String(formData.get("desc") || ""),
    tags: splitList(formData.get("tags")),
    favorite: formData.get("favorite") === "true"
  };
}

export function buildMemoryFromFormData({
  formData,
  existing,
  people,
  places,
  settings,
  photoIds,
}: {
  formData: FormData;
  existing?: MemoryEvent;
  people: Array<{ id: string; name: string; nickname?: string }>;
  places: Array<{ id: string; name: string; storeName?: string; area?: string; mall?: string; address?: string }>;
  settings: AppSettings;
  photoIds?: string[];
}): MemoryEvent {
  const selectedPersonIds = formData
    .getAll("personIds")
    .map((item) => String(item))
    .filter(Boolean);
  const legacyPersonId = String(formData.get("personId") || "");
  const rawTitle = String(formData.get("title") || "");
  const content = String(formData.get("content") || "");
  const memoryMode = String(formData.get("memoryMode") || "");
  const hasPlaceFields = formData.has("placeId") || formData.has("placeIds");
  const selectedPlaceIds = formData
    .getAll("placeIds")
    .map((item) => String(item))
    .filter(Boolean);
  const selectedPlaceId = String(formData.get("placeId") || selectedPlaceIds[0] || "");
  const inputDate = String(formData.get("date") || (existing ? existing.date : new Date().toISOString().slice(0, 10)));
  const quickInference = inferQuickMemory({
    rawTitle,
    content,
    people,
    places,
    fallbackDate: inputDate,
    selectedPersonIds,
    selectedPlaceId,
    fallbackPersonId: legacyPersonId
  });
  const matchedPersonIds = selectedPersonIds.length
    ? selectedPersonIds
    : existing
      ? [legacyPersonId].filter(Boolean)
      : quickInference.personIds;
  const inferredPlaceId = !existing ? quickInference.placeId : "";
  const matchedPlaceIds = hasPlaceFields
    ? normalizeMemoryPlaceIds(selectedPlaceIds.length ? selectedPlaceIds : inferredPlaceId ? [inferredPlaceId] : [], selectedPlaceId)
    : existing
      ? getMemoryPlaceIds(existing)
      : normalizeMemoryPlaceIds(inferredPlaceId ? [inferredPlaceId] : [], selectedPlaceId);
  const memoryId = existing?.id || String(formData.get("memoryId") || "") || uid("m");

  return {
    id: memoryId,
    title: buildMemoryTitle(rawTitle, content),
    date: memoryMode === "quick" && !existing ? quickInference.date : inputDate,
    personIds: matchedPersonIds,
    placeId: matchedPlaceIds[0] || "",
    placeIds: matchedPlaceIds,
    mood: String(formData.get("mood") || (existing ? "" : settings.defaultMood)),
    content,
    tags: splitList(formData.get("tags")),
    photos: photoIds !== undefined ? photoIds : existing?.photos || []
  };
}

function parseRating(value: string) {
  if (!value) return 0;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : 0;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolvePlaceMerge(state: LifeLogState, preview: PlaceMergePreview) {
  const existingIds = new Set(state.places.map((place) => place.id));
  const removedIds = preview.sources
    .map((source) => source.id)
    .filter((id) => existingIds.has(id) && id !== preview.canonical.id);

  const nextMemories = removedIds.reduce(
    (current, sourceId) => mergeMemoryPlaceReferences(current, sourceId, preview.canonical.id),
    state.memories
  );
  const nextPlans = removedIds.reduce(
    (current, sourceId) => replacePlanPlaceReferences(current, sourceId, preview.canonical.id),
    state.anniversaryPlans
  );
  const nextPlaces = state.places
    .filter((place) => !removedIds.includes(place.id))
    .map((place) => (place.id === preview.canonical.id ? preview.merged : place));

  return {
    nextState: {
      ...state,
      places: nextPlaces,
      memories: nextMemories,
      anniversaryPlans: nextPlans
    },
    removedIds
  };
}

export function buildPlaceMergeHistoryEntry(
  snapshotState: LifeLogState,
  nextState: LifeLogState,
  removedIds: string[],
  meta: Pick<PlaceMergeHistoryEntry, "reason" | "strength" | "placeIds">
) {
  return {
    entry: {
      id: `place_merge_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      happenedAt: new Date().toISOString(),
      reason: meta.reason,
      strength: meta.strength,
      placeIds: Array.from(new Set(meta.placeIds)),
      snapshot: {
        people: [...snapshotState.people],
        places: [...snapshotState.places],
        memories: [...snapshotState.memories],
        anniversaryPlans: [...snapshotState.anniversaryPlans]
      }
    },
    nextState,
    removedIds
  };
}

function replacePlanPlaceReferences(statePlans: LifeLogState["anniversaryPlans"], fromId: string, toId: string) {
  return statePlans.map((plan) => {
    if (!plan.placeIds.includes(fromId)) return plan;
    const placeIds = Array.from(new Set(plan.placeIds.map((id) => (id === fromId ? toId : id))));
    return {
      ...plan,
      placeIds,
      updatedAt: new Date().toISOString()
    };
  });
}
