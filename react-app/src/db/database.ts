import Dexie, { type Table } from "dexie";
import { seedData } from "../data/seedData";
import type {
  AnniversaryPlan,
  AppSettings,
  LifeLogState,
  MemoryEvent,
  NotionPageMapping,
  NotionSettings,
  NotionSyncHistoryEntry,
  NotionSyncQueueItem,
  Person,
  Photo,
  Place,
  PlaceMergeHistoryEntry,
  PreferenceGroup,
  ReminderSettings
} from "../types";
import { defaultAppSettings, defaultNotionSettings, defaultReminderSettings } from "../types";
import { normalizePlacePlatformLinks } from "../utils/placeLinks";
import { normalizeNotionId } from "../utils/notionIds";
import { removeMemoryPlaceId, getMemoryPlaceIds } from "../utils/memoryPlaces";
import { inferProvince, normalizeCityName, normalizeStoredMall } from "../utils/placeMeta";
import { isDateValue, normalizeAnniversary } from "../utils/lifelogHelpers";

const LEGACY_STORAGE_KEY = "lifelog-react-state-v1";

class LifeLogDatabase extends Dexie {
  people!: Table<Person, string>;
  places!: Table<Place, string>;
  memories!: Table<MemoryEvent, string>;
  anniversaryPlans!: Table<AnniversaryPlan, string>;
  placeMergeHistory!: Table<PlaceMergeHistoryEntry, string>;
  appSettings!: Table<{ key: string; value: AppSettings }, string>;
  photos!: Table<Photo, string>;
  reminderSettings!: Table<{ key: string; value: ReminderSettings }, string>;
  notionSettings!: Table<{ key: string; value: NotionSettings }, string>;
  notionPageMappings!: Table<NotionPageMapping, string>;
  notionSyncHistory!: Table<NotionSyncHistoryEntry, string>;
  notionSyncQueue!: Table<NotionSyncQueueItem, string>;

  constructor() {
    super("LifeLogDatabase");
    this.version(1).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, city, area, category, favorite",
      memories: "id, date, placeId, *personIds"
    });
    this.version(2).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *personIds"
    });
    this.version(3).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *personIds",
      placeMergeHistory: "id, happenedAt"
    });
    this.version(4).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *personIds",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key"
    });
    this.version(5)
      .stores({
        people: "id, name, birthday, relationship, favorite",
        places: "id, name, country, province, city, mall, area, category, favorite",
        memories: "id, date, placeId, *personIds",
        placeMergeHistory: "id, happenedAt",
        appSettings: "key"
      })
      .upgrade((trans) => {
        return trans
          .table("memories")
          .toCollection()
          .modify((memory) => {
            if (!memory.photos) {
              memory.photos = [];
            }
          });
      });
    this.version(6).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *personIds",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order"
    });
    this.version(7).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *personIds",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key"
    });
    this.version(8)
      .stores({
        people: "id, name, birthday, relationship, favorite",
        places: "id, name, country, province, city, mall, area, category, favorite",
        memories: "id, date, placeId, *placeIds, *personIds",
        placeMergeHistory: "id, happenedAt",
        appSettings: "key",
        photos: "id, memoryId, uploadedAt, order",
        reminderSettings: "key"
      })
      .upgrade((trans) => {
        return trans
          .table("memories")
          .toCollection()
          .modify((memory) => {
            memory.placeIds = getMemoryPlaceIds(memory);
          });
      });
    this.version(9).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *placeIds, *personIds",
      anniversaryPlans: "id, personId, targetDate, status, occurrenceYear",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key"
    });
    this.version(10).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *placeIds, *personIds",
      anniversaryPlans: "id, personId, targetDate, status, occurrenceYear",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key",
      notionSettings: "key"
    });
    this.version(11).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *placeIds, *personIds",
      anniversaryPlans: "id, personId, targetDate, status, occurrenceYear",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key",
      notionSettings: "key",
      notionPageMappings: "id, entityType, entityId, [entityType+entityId]"
    });
    this.version(12).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *placeIds, *personIds",
      anniversaryPlans: "id, personId, targetDate, status, occurrenceYear",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key",
      notionSettings: "key",
      notionPageMappings: "id, entityType, entityId, [entityType+entityId]",
      notionSyncHistory: "id, finishedAt, trigger, status"
    });
    this.version(13).stores({
      people: "id, name, birthday, relationship, favorite",
      places: "id, name, country, province, city, mall, area, category, favorite",
      memories: "id, date, placeId, *placeIds, *personIds",
      anniversaryPlans: "id, personId, targetDate, status, occurrenceYear",
      placeMergeHistory: "id, happenedAt",
      appSettings: "key",
      photos: "id, memoryId, uploadedAt, order",
      reminderSettings: "key",
      notionSettings: "key",
      notionPageMappings: "id, entityType, entityId, [entityType+entityId]",
      notionSyncHistory: "id, finishedAt, trigger, status",
      notionSyncQueue: "id, entityType, entityId, status, updatedAt"
    });
  }
}

export const db = new LifeLogDatabase();

export async function loadLifeLogState(): Promise<LifeLogState> {
  await initializeDatabase();
  return readAll();
}

export async function loadAppSettings(): Promise<AppSettings> {
  await initializeDatabase();
  const entry = await db.appSettings.get("app");
  return {
    ...defaultAppSettings,
    ...(entry?.value || {})
  };
}

export async function saveAppSettings(settings: AppSettings) {
  await db.appSettings.put({
    key: "app",
    value: {
      ...defaultAppSettings,
      ...settings
    }
  });
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  await initializeDatabase();
  const entry = await db.reminderSettings.get("reminder");
  return {
    ...defaultReminderSettings,
    ...(entry?.value || {})
  };
}

export async function saveReminderSettings(settings: ReminderSettings) {
  await db.reminderSettings.put({
    key: "reminder",
    value: {
      ...defaultReminderSettings,
      ...settings
    }
  });
}

export async function loadNotionSettings(): Promise<NotionSettings> {
  await initializeDatabase();
  const entry = await db.notionSettings.get("notion");
  return normalizeNotionSettings(entry?.value);
}

export async function saveNotionSettings(settings: NotionSettings) {
  await db.notionSettings.put({
    key: "notion",
    value: normalizeNotionSettings(settings)
  });
}

export async function loadNotionPageMappings(): Promise<NotionPageMapping[]> {
  await initializeDatabase();
  return db.notionPageMappings.toArray();
}

export async function saveNotionPageMapping(mapping: NotionPageMapping) {
  await db.notionPageMappings.put(mapping);
}

export async function saveNotionPageMappings(mappings: NotionPageMapping[]) {
  if (!mappings.length) return;
  await db.notionPageMappings.bulkPut(mappings);
}

export async function loadNotionPageMapping(entityType: NotionPageMapping["entityType"], entityId: string) {
  await initializeDatabase();
  const id = buildNotionMappingId(entityType, entityId);
  return db.notionPageMappings.get(id);
}

export async function loadNotionSyncHistory(limit = 20): Promise<NotionSyncHistoryEntry[]> {
  await initializeDatabase();
  return db.notionSyncHistory.orderBy("finishedAt").reverse().limit(limit).toArray();
}

export async function saveNotionSyncHistoryEntry(entry: NotionSyncHistoryEntry, limit = 20) {
  await db.transaction("rw", db.notionSyncHistory, async () => {
    await db.notionSyncHistory.put(entry);
    const staleEntries = await db.notionSyncHistory.orderBy("finishedAt").reverse().offset(limit).toArray();
    if (staleEntries.length) {
      await db.notionSyncHistory.bulkDelete(staleEntries.map((item) => item.id));
    }
  });
}

export async function loadNotionSyncQueue(): Promise<NotionSyncQueueItem[]> {
  await initializeDatabase();
  return db.notionSyncQueue.orderBy("updatedAt").toArray();
}

export async function saveNotionSyncQueueItems(items: NotionSyncQueueItem[]) {
  if (!items.length) return;
  await initializeDatabase();
  await db.notionSyncQueue.bulkPut(items);
}

export async function deleteNotionSyncQueueItems(ids: string[]) {
  if (!ids.length) return;
  await initializeDatabase();
  await db.notionSyncQueue.bulkDelete(ids);
}

export async function savePersonRecord(person: Person) {
  await db.people.put(person);
}

export async function savePlaceRecord(place: Place) {
  await db.places.put(place);
}

export async function savePlaceRecords(places: Place[]) {
  await db.places.bulkPut(places);
}

export async function saveMemoryRecord(memory: MemoryEvent) {
  await db.memories.put(memory);
}

export async function saveAnniversaryPlanRecord(plan: AnniversaryPlan) {
  await db.anniversaryPlans.put(plan);
}

export async function deleteAnniversaryPlanRecord(id: string) {
  await db.anniversaryPlans.delete(id);
}

export async function loadPlaceMergeHistory(limit = 10) {
  return await db.placeMergeHistory.orderBy("happenedAt").reverse().limit(limit).toArray();
}

export async function savePlaceMergeHistoryEntry(entry: PlaceMergeHistoryEntry, limit = 10) {
  await db.transaction("rw", db.placeMergeHistory, async () => {
    await db.placeMergeHistory.put(entry);
    const staleEntries = await db.placeMergeHistory.orderBy("happenedAt").reverse().offset(limit).toArray();
    if (staleEntries.length) {
      await db.placeMergeHistory.bulkDelete(staleEntries.map((item) => item.id));
    }
  });
}

export async function clearPlaceMergeHistory() {
  await db.placeMergeHistory.clear();
}

export async function deletePersonRecord(id: string) {
  await db.transaction("rw", db.people, db.memories, db.anniversaryPlans, async () => {
    await db.people.delete(id);
    await db.anniversaryPlans.where("personId").equals(id).delete();
    const affected = await db.memories.where("personIds").equals(id).toArray();
    if (affected.length) {
      await Promise.all(
        affected.map((memory) =>
          db.memories.put({
            ...memory,
            personIds: (memory.personIds || []).filter((personId) => personId !== id)
          })
        )
      );
    }
  });
}

export async function deletePlaceRecord(id: string) {
  await db.transaction("rw", db.places, db.memories, db.anniversaryPlans, async () => {
    await db.places.delete(id);
    const affectedPlans = await db.anniversaryPlans.filter((plan) => (plan.placeIds || []).includes(id)).toArray();
    if (affectedPlans.length) {
      await db.anniversaryPlans.bulkPut(
        affectedPlans.map((plan) => ({
          ...plan,
          placeIds: (plan.placeIds || []).filter((placeId) => placeId !== id),
          updatedAt: new Date().toISOString()
        }))
      );
    }
    const affected = await db.memories.filter((memory) => getMemoryPlaceIds(memory).includes(id)).toArray();
    if (affected.length) {
      await Promise.all(
        affected.map((memory) =>
          db.memories.put(removeMemoryPlaceId(memory, id))
        )
      );
    }
  });
}

export async function deleteMemoryRecord(id: string) {
  await db.transaction("rw", db.memories, db.photos, db.anniversaryPlans, async () => {
    await db.memories.delete(id);
    // 删除关联的照片
    await db.photos.where("memoryId").equals(id).delete();
    const affectedPlans = await db.anniversaryPlans.filter((plan) => plan.memoryId === id).toArray();
    if (affectedPlans.length) {
      await db.anniversaryPlans.bulkPut(
        affectedPlans.map((plan) => ({
          ...plan,
          memoryId: undefined,
          updatedAt: new Date().toISOString()
        }))
      );
    }
  });
}

export async function savePhotoRecord(photo: Photo) {
  await db.photos.put(photo);
}

export async function savePhotoRecords(photos: Photo[]) {
  await db.photos.bulkPut(photos);
}

export async function loadPhotosByMemoryId(memoryId: string): Promise<Photo[]> {
  return await db.photos.where("memoryId").equals(memoryId).sortBy("order");
}

export async function loadPhotosByIds(photoIds: string[]): Promise<Photo[]> {
  if (!photoIds.length) return [];
  const order = new Map(photoIds.map((id, index) => [id, index]));
  const photos = await db.photos.bulkGet(photoIds);
  return photos
    .filter((photo): photo is Photo => Boolean(photo))
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export async function loadAllPhotos(): Promise<Photo[]> {
  return await db.photos.toArray();
}

export async function deletePhotoRecord(id: string) {
  await db.photos.delete(id);
}

export async function deletePhotoRecords(ids: string[]) {
  if (!ids.length) return;
  await db.photos.bulkDelete(ids);
}

export async function deletePhotosByMemoryId(memoryId: string) {
  await db.photos.where("memoryId").equals(memoryId).delete();
}

export async function replaceAllData(input: Partial<LifeLogState>) {
  const next = normalizeState(input);
  await db.transaction("rw", [db.people, db.places, db.memories, db.anniversaryPlans, db.placeMergeHistory], async () => {
    await db.people.clear();
    await db.places.clear();
    await db.memories.clear();
    await db.anniversaryPlans.clear();
    await db.placeMergeHistory.clear();
    await db.people.bulkPut(next.people);
    await db.places.bulkPut(next.places);
    await db.memories.bulkPut(next.memories);
    if (next.anniversaryPlans.length) await db.anniversaryPlans.bulkPut(next.anniversaryPlans);
  });
}

export async function replaceAllBackupData({
  state,
  photos = [],
  settings = defaultAppSettings,
  reminderSettings = defaultReminderSettings,
  placeMergeHistory = []
}: {
  state: Partial<LifeLogState>;
  photos?: Photo[];
  settings?: AppSettings;
  reminderSettings?: ReminderSettings;
  placeMergeHistory?: PlaceMergeHistoryEntry[];
}) {
  const next = normalizeState(state);
  await db.transaction(
    "rw",
    [db.people, db.places, db.memories, db.anniversaryPlans, db.placeMergeHistory, db.appSettings, db.reminderSettings, db.photos],
    async () => {
      await db.people.clear();
      await db.places.clear();
      await db.memories.clear();
      await db.anniversaryPlans.clear();
      await db.placeMergeHistory.clear();
      await db.appSettings.clear();
      await db.reminderSettings.clear();
      await db.photos.clear();
      await db.people.bulkPut(next.people);
      await db.places.bulkPut(next.places);
      await db.memories.bulkPut(next.memories);
      if (next.anniversaryPlans.length) await db.anniversaryPlans.bulkPut(next.anniversaryPlans);
      if (photos.length) await db.photos.bulkPut(photos);
      if (placeMergeHistory.length) await db.placeMergeHistory.bulkPut(placeMergeHistory);
      await db.appSettings.put({ key: "app", value: { ...defaultAppSettings, ...settings } });
      await db.reminderSettings.put({ key: "reminder", value: { ...defaultReminderSettings, ...reminderSettings } });
    }
  );

  return next;
}

export async function resetDatabase() {
  await replaceAllData(seedData);
}

export async function estimateStorageUsage() {
  if (!("storage" in navigator) || !navigator.storage?.estimate) {
    return null;
  }

  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}

export async function runPlaceMergeTransaction(nextState: LifeLogState, removedIds: string[]) {
  await db.transaction("rw", db.places, db.memories, db.anniversaryPlans, async () => {
    if (removedIds.length) {
      await db.places.bulkDelete(removedIds);
    }
    await db.places.bulkPut(nextState.places);
    await db.memories.bulkPut(nextState.memories);
    await db.anniversaryPlans.clear();
    if (nextState.anniversaryPlans.length) await db.anniversaryPlans.bulkPut(nextState.anniversaryPlans);
  });
}

async function initializeDatabase() {
  const count = await db.people.count();
  if (count > 0) return;

  const legacy = readLegacyState();
  await replaceAllData(legacy || seedData);
}

export function buildNotionMappingId(entityType: NotionPageMapping["entityType"], entityId: string) {
  return `${entityType}:${entityId}`;
}

async function readAll(): Promise<LifeLogState> {
  const [people, places, memories, anniversaryPlans] = await Promise.all([
    db.people.toArray(),
    db.places.toArray(),
    db.memories.toArray(),
    db.anniversaryPlans.toArray()
  ]);

  return normalizeState({ people, places, memories, anniversaryPlans });
}

function readLegacyState(): Partial<LifeLogState> | null {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<LifeLogState>;
  } catch {
    return null;
  }
}

function normalizeNotionSettings(value: Partial<NotionSettings> | undefined): NotionSettings {
  const next = {
    ...defaultNotionSettings,
    ...(value || {})
  };
  return {
    enabled: Boolean(next.enabled && next.token),
    mode: next.mode === "oauth" ? "oauth" : "manual-token",
    token: String(next.token || "").trim(),
    workspaceName: String(next.workspaceName || "").trim(),
    workspaceBotName: String(next.workspaceBotName || "").trim(),
    parentPageId: normalizeNotionId(next.parentPageId),
    peopleDatabaseId: normalizeNotionId(next.peopleDatabaseId),
    placesDatabaseId: normalizeNotionId(next.placesDatabaseId),
    memoriesDatabaseId: normalizeNotionId(next.memoriesDatabaseId),
    plansDatabaseId: normalizeNotionId(next.plansDatabaseId),
    syncPageContent: next.syncPageContent !== false,
    apiVersion: String(next.apiVersion || defaultNotionSettings.apiVersion).trim(),
    lastConnectionTestAt: next.lastConnectionTestAt,
    lastConnectionStatus: ["idle", "connected", "failed"].includes(String(next.lastConnectionStatus))
      ? next.lastConnectionStatus
      : "idle",
    lastConnectionMessage: String(next.lastConnectionMessage || ""),
    lastFullSyncAt: next.lastFullSyncAt
  };
}

function normalizeGroups(value: unknown, fallbackCategory: string): PreferenceGroup[] {
  if (!Array.isArray(value)) return [];
  if (!value.length) return [];

  if (typeof value[0] === "string") {
    return [{ category: fallbackCategory, items: value.filter(Boolean).map(String) }];
  }

  return value
    .map((item) => {
      const group = item as Partial<PreferenceGroup>;
      return {
        category: String(group.category || fallbackCategory),
        items: Array.isArray(group.items) ? group.items.filter(Boolean).map(String) : []
      };
    })
    .filter((group) => group.items.length);
}

export function normalizeState(input: Partial<LifeLogState>): LifeLogState {
  const people = (input.people || seedData.people).map((person) => ({
    ...person,
    birthdayIsLunar: false,
    preferences: normalizeGroups((person as unknown as { preferences: unknown }).preferences, "喜好"),
    dislikes: normalizeGroups((person as unknown as { dislikes: unknown }).dislikes, "禁忌"),
    anniversaries: normalizePersonAnniversaries((person as unknown as { anniversaries: unknown }).anniversaries)
  })) as Person[];
  const places = (input.places || seedData.places).map((place) => ({
    ...place,
    country: place.country || "中国",
    province: inferProvince({
      country: place.country || "中国",
      province: (place as Place).province || "",
      city: place.city || "杭州",
      address: place.address || ""
    }),
    city: normalizeCityName(place.city || "杭州"),
    area: place.area || "未分组",
    mall: normalizeStoredMall(place as Partial<Place>),
    storeName: place.storeName || "",
    address: place.address || "",
    latitude: place.latitude,
    longitude: place.longitude,
    mapUrl: place.mapUrl || "",
    sourceUrl: place.sourceUrl || "",
    platformLinks: normalizePlacePlatformLinks(place.platformLinks),
    photos: Array.isArray(place.photos) ? place.photos.filter(Boolean).map(String) : []
  })) as Place[];
  const memories = (input.memories || seedData.memories).map((memory) => ({
    ...memory,
    kind: memory.kind === "plan" ? "plan" : "memory",
    personIds: Array.isArray(memory.personIds) ? memory.personIds.filter(Boolean).map(String) : [],
    placeId: typeof memory.placeId === "string" ? memory.placeId : "",
    placeIds: getMemoryPlaceIds(memory as MemoryEvent),
    mood: memory.mood || "日常",
    tags: Array.isArray(memory.tags) ? memory.tags.filter(Boolean).map(String) : [],
    photos: Array.isArray(memory.photos) ? memory.photos.filter(Boolean).map(String) : []
  })) as MemoryEvent[];
  const peopleIds = new Set(people.map((person) => person.id));
  const placeIds = new Set(places.map((place) => place.id));
  const memoryIds = new Set(memories.map((memory) => memory.id));

  return {
    people,
    places,
    memories,
    anniversaryPlans: normalizeAnniversaryPlans(input.anniversaryPlans, peopleIds, placeIds, memoryIds)
  };
}

function normalizePersonAnniversaries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeAnniversary(item as Partial<Person["anniversaries"][number]>))
    .filter((item) => item.title && isDateValue(item.date));
}

function normalizeAnniversaryPlans(
  value: unknown,
  peopleIds: Set<string>,
  placeIds: Set<string>,
  memoryIds: Set<string>
): AnniversaryPlan[] {
  if (!Array.isArray(value)) return [];

  const result: AnniversaryPlan[] = [];

  value.forEach((item) => {
    const plan = item as Partial<AnniversaryPlan>;
    const personId = String(plan.personId || "");
    if (!personId || !peopleIds.has(personId)) return;
    const createdAt = String(plan.createdAt || new Date().toISOString());
    const updatedAt = String(plan.updatedAt || createdAt);
    const status = ["todo", "doing", "done", "skipped"].includes(String(plan.status))
      ? (plan.status as AnniversaryPlan["status"])
      : "todo";
    const targetKind = plan.targetKind === "milestone" && Number.isInteger(Number(plan.milestoneDay)) ? "milestone" : "annual";
    result.push({
      id: String(plan.id || `ap_${Date.now()}_${Math.random().toString(16).slice(2)}`),
      personId,
      anniversaryTitle: String(plan.anniversaryTitle || ""),
      anniversaryDate: String(plan.anniversaryDate || ""),
      occurrenceYear: Number(plan.occurrenceYear) || new Date().getFullYear(),
      targetKind,
      milestoneDay: targetKind === "milestone" ? Number(plan.milestoneDay) : undefined,
      milestoneLabel: targetKind === "milestone" ? String(plan.milestoneLabel || "") : undefined,
      targetDate: String(plan.targetDate || ""),
      status,
      title: String(plan.title || ""),
      notes: String(plan.notes || ""),
      budget: String(plan.budget || ""),
      checklist: normalizePlanTodos(plan.checklist),
      placeIds: Array.isArray(plan.placeIds)
        ? Array.from(new Set(plan.placeIds.map(String).filter((id) => placeIds.has(id))))
        : [],
      reminderDaysBefore: Array.isArray(plan.reminderDaysBefore)
        ? Array.from(new Set(plan.reminderDaysBefore.map(Number).filter((days) => Number.isFinite(days) && days >= 0))).sort((a, b) => b - a)
        : [],
      memoryId: plan.memoryId && memoryIds.has(String(plan.memoryId)) ? String(plan.memoryId) : undefined,
      createdAt,
      updatedAt
    });
  });

  return result;
}

function normalizePlanTodos(value: unknown): AnniversaryPlan["checklist"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const todo = item as Partial<AnniversaryPlan["checklist"][number]>;
      const text = String(todo.text || "").trim();
      if (!text) return null;
      return {
        id: String(todo.id || `todo_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        text,
        done: Boolean(todo.done)
      };
    })
    .filter((todo): todo is AnniversaryPlan["checklist"][number] => Boolean(todo));
}
