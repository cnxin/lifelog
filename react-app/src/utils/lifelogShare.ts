import type { LifeLogState, MemoryEvent, Person, Photo, Place } from "../types";
import { isRecord, uid } from "./lifelogHelpers";
import { serializeBackupPhoto, type BackupPhotoRecord } from "./lifelogBackup";
import { getMemoryPlaceIds } from "./memoryPlaces";

export type LifeLogShareType = "memory" | "places";
export type SharedPeopleMode = "public" | "anonymous" | "hidden";
export type SharedMemoryPlaceMode = "full" | "name" | "hidden";

export interface MemoryShareOptions {
  includeContent: boolean;
  peopleMode: SharedPeopleMode;
  placeMode: SharedMemoryPlaceMode;
  includePhotos: boolean;
}

export interface PlaceShareOptions {
  includeAddress: boolean;
  includePreciseLocation: boolean;
  includeLinks: boolean;
  includePhotos: boolean;
}

export interface LifeLogSharePayload {
  schemaVersion: 1;
  kind: "lifelog-share";
  shareType: LifeLogShareType;
  exportedAt: string;
  appVersion: string;
  title: string;
  options: {
    memory?: MemoryShareOptions;
    place?: PlaceShareOptions;
  };
  data: {
    people: Person[];
    places: Place[];
    memories: MemoryEvent[];
    photos: BackupPhotoRecord[];
  };
  integrity: {
    people: number;
    places: number;
    memories: number;
    photos: number;
  };
}

export interface LifeLogShareImportPreview {
  title: string;
  shareType: LifeLogShareType;
  exportedAt: string;
  appVersion: string;
  incoming: {
    people: number;
    places: number;
    memories: number;
    photos: number;
  };
  willCreate: {
    people: number;
    places: number;
    memories: number;
    photos: number;
  };
  willReuse: {
    people: number;
    places: number;
  };
  skippedMemories: number;
  detail: {
    createPeople: string[];
    reusePeople: string[];
    createPlaces: string[];
    reusePlaces: string[];
    createMemories: string[];
    skipMemories: string[];
    missingFields: string[];
  };
}

export interface LifeLogShareImportResult {
  peopleCreated: number;
  placesCreated: number;
  placesReused: number;
  memoriesCreated: number;
  memoriesSkipped: number;
  photosCreated: number;
  createdPersonIds: string[];
  createdPlaceIds: string[];
  createdMemoryIds: string[];
  createdPhotoIds: string[];
}

interface ShareImportPlan {
  people: Person[];
  places: Place[];
  memories: MemoryEvent[];
  photos: Photo[];
  result: LifeLogShareImportResult;
}

export async function buildMemorySharePayload({
  state,
  memoryId,
  photos,
  options,
  appVersion
}: {
  state: LifeLogState;
  memoryId: string;
  photos: Photo[];
  options: MemoryShareOptions;
  appVersion: string;
}): Promise<LifeLogSharePayload> {
  const memory = state.memories.find((item) => item.id === memoryId);
  if (!memory) throw new Error("没有找到要分享的回忆。");

  const people = buildSharedPeople(memory.personIds || [], state.people, options.peopleMode);
  const places = buildSharedMemoryPlaces(getMemoryPlaceIds(memory), state.places, options.placeMode);
  const sharedPhotos = options.includePhotos ? photos.filter((photo) => (memory.photos || []).includes(photo.id)) : [];
  const photoRecords = await Promise.all(sharedPhotos.map(serializeBackupPhoto));
  const sharedMemory = sanitizeMemory(memory, options, people, places, photoRecords);

  return buildPayload({
    shareType: "memory",
    title: sharedMemory.title || "回忆分享",
    appVersion,
    options: { memory: options },
    data: {
      people,
      places,
      memories: [sharedMemory],
      photos: photoRecords
    }
  });
}

export function buildPlacesSharePayload({
  state,
  placeIds,
  options,
  appVersion
}: {
  state: LifeLogState;
  placeIds: string[];
  options: PlaceShareOptions;
  appVersion: string;
}): LifeLogSharePayload {
  const placeIdSet = new Set(placeIds);
  const places = state.places
    .filter((place) => placeIdSet.has(place.id))
    .map((place) => sanitizePlace(place, options));
  if (!places.length) throw new Error("没有可分享的地点。");

  return buildPayload({
    shareType: "places",
    title: places.length === 1 ? places[0].name || "地点分享" : `地点分享（${places.length} 个）`,
    appVersion,
    options: { place: options },
    data: {
      people: [],
      places,
      memories: [],
      photos: []
    }
  });
}

export function isLifeLogSharePayload(value: unknown): value is LifeLogSharePayload {
  return isRecord(value) && value.kind === "lifelog-share" && value.schemaVersion === 1 && isRecord(value.data);
}

export function normalizeLifeLogSharePayload(value: unknown): LifeLogSharePayload {
  if (!isLifeLogSharePayload(value)) {
    throw new Error("这不是有效的 LifeLog 分享包。");
  }

  const data = value.data;
  const people = Array.isArray(data.people) ? data.people.map(normalizeSharedPerson).filter(isPresent) : [];
  const places = Array.isArray(data.places) ? data.places.map(normalizeSharedPlace).filter(isPresent) : [];
  const memories = Array.isArray(data.memories) ? data.memories.map(normalizeSharedMemory).filter(isPresent) : [];
  const photos = Array.isArray(data.photos) ? data.photos.filter(isBackupPhotoRecord) : [];
  const payload: LifeLogSharePayload = {
    schemaVersion: 1,
    kind: "lifelog-share",
    shareType: value.shareType === "places" ? "places" : "memory",
    exportedAt: String(value.exportedAt || ""),
    appVersion: String(value.appVersion || ""),
    title: String(value.title || "LifeLog 分享"),
    options: isRecord(value.options) ? value.options as LifeLogSharePayload["options"] : {},
    data: {
      people,
      places,
      memories,
      photos
    },
    integrity: {
      people: people.length,
      places: places.length,
      memories: memories.length,
      photos: photos.length
    }
  };

  validateShareIntegrity(value.integrity, payload);
  return payload;
}

export function buildShareImportPreview(payloadInput: LifeLogSharePayload, state: LifeLogState): LifeLogShareImportPreview {
  const payload = normalizeLifeLogSharePayload(payloadInput);
  const analysis = analyzeShareImport(payload, state);
  return {
    title: payload.title,
    shareType: payload.shareType,
    exportedAt: payload.exportedAt,
    appVersion: payload.appVersion,
    incoming: {
      people: payload.data.people.length,
      places: payload.data.places.length,
      memories: payload.data.memories.length,
      photos: payload.data.photos.length
    },
    willCreate: {
      people: analysis.peopleToCreate,
      places: analysis.placesToCreate,
      memories: analysis.memoriesToCreate,
      photos: analysis.memoriesToCreate ? payload.data.photos.length : 0
    },
    willReuse: {
      people: analysis.peopleToReuse,
      places: analysis.placesToReuse
    },
    skippedMemories: analysis.memoriesToSkip,
    detail: analysis.detail
  };
}

export async function buildShareImportPlan(payloadInput: LifeLogSharePayload, state: LifeLogState): Promise<ShareImportPlan> {
  const payload = normalizeLifeLogSharePayload(payloadInput);
  const personIdMap = new Map<string, string>();
  const placeIdMap = new Map<string, string>();
  const memoryKeySet = new Set(state.memories.map(buildMemoryDuplicateKey));
  const people: Person[] = [];
  const places: Place[] = [];
  let peopleReused = 0;
  let placesReused = 0;
  let memoriesSkipped = 0;

  payload.data.people.forEach((person) => {
    const existing = findMatchingPerson(person, state.people);
    if (existing) {
      personIdMap.set(person.id, existing.id);
      peopleReused += 1;
      return;
    }
    const next = {
      ...sanitizeIncomingPerson(person),
      id: uid("p")
    };
    personIdMap.set(person.id, next.id);
    people.push(next);
  });

  payload.data.places.forEach((place) => {
    const existing = findMatchingPlace(place, state.places);
    if (existing) {
      placeIdMap.set(place.id, existing.id);
      placesReused += 1;
      return;
    }
    const next = {
      ...sanitizeIncomingPlace(place),
      id: uid("l")
    };
    placeIdMap.set(place.id, next.id);
    places.push(next);
  });

  const photoRecordsByMemoryId = groupPhotoRecordsByMemoryId(payload.data.photos);
  const memories: MemoryEvent[] = [];
  const photos: Photo[] = [];

  for (const memory of payload.data.memories) {
    const duplicateKey = buildMemoryDuplicateKey(memory);
    if (memoryKeySet.has(duplicateKey)) {
      memoriesSkipped += 1;
      continue;
    }

    const nextMemoryId = uid("m");
    const nextPersonIds = uniqueIds((memory.personIds || []).map((id) => personIdMap.get(id) || ""));
    const nextPlaceIds = uniqueIds(getMemoryPlaceIds(memory).map((id) => placeIdMap.get(id) || ""));
    const memoryPhotos = await Promise.all(
      (photoRecordsByMemoryId.get(memory.id) || []).map((record, index) => restoreSharedPhoto(record, nextMemoryId, index))
    );
    photos.push(...memoryPhotos);

    const nextMemory: MemoryEvent = {
      ...memory,
      id: nextMemoryId,
      personIds: nextPersonIds,
      placeId: nextPlaceIds[0] || "",
      placeIds: nextPlaceIds,
      photos: memoryPhotos.map((photo) => photo.id)
    };
    memories.push(nextMemory);
    memoryKeySet.add(buildMemoryDuplicateKey(nextMemory));
  }

  return {
    people,
    places,
    memories,
    photos,
    result: {
      peopleCreated: people.length,
      placesCreated: places.length,
      placesReused,
      memoriesCreated: memories.length,
      memoriesSkipped,
      photosCreated: photos.length,
      createdPersonIds: people.map((person) => person.id),
      createdPlaceIds: places.map((place) => place.id),
      createdMemoryIds: memories.map((memory) => memory.id),
      createdPhotoIds: photos.map((photo) => photo.id)
    }
  };
}

export function buildShareFileName(payload: Pick<LifeLogSharePayload, "shareType" | "title">) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = payload.title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 24) || "lifelog";
  return `lifelog-share-${payload.shareType}-${slug}-${date}.json`;
}

function buildPayload({
  shareType,
  title,
  appVersion,
  options,
  data
}: {
  shareType: LifeLogShareType;
  title: string;
  appVersion: string;
  options: LifeLogSharePayload["options"];
  data: LifeLogSharePayload["data"];
}): LifeLogSharePayload {
  return {
    schemaVersion: 1,
    kind: "lifelog-share",
    shareType,
    exportedAt: new Date().toISOString(),
    appVersion,
    title,
    options,
    data,
    integrity: {
      people: data.people.length,
      places: data.places.length,
      memories: data.memories.length,
      photos: data.photos.length
    }
  };
}

function buildSharedPeople(personIds: string[], people: Person[], mode: SharedPeopleMode) {
  if (mode === "hidden") return [];
  const personById = new Map(people.map((person) => [person.id, person]));
  return uniqueIds(personIds)
    .map((id, index) => {
      const person = personById.get(id);
      if (!person) return null;
      return sanitizePerson(person, mode === "anonymous" ? `同行人 ${index + 1}` : person.name);
    })
    .filter((person): person is Person => Boolean(person));
}

function buildSharedMemoryPlaces(placeIds: string[], places: Place[], mode: SharedMemoryPlaceMode) {
  if (mode === "hidden") return [];
  const placeById = new Map(places.map((place) => [place.id, place]));
  return uniqueIds(placeIds)
    .map((id) => {
      const place = placeById.get(id);
      if (!place) return null;
      if (mode === "name") {
        return sanitizePlace(place, {
          includeAddress: false,
          includePreciseLocation: false,
          includeLinks: false,
          includePhotos: false
        });
      }
      return sanitizePlace(place, {
        includeAddress: true,
        includePreciseLocation: true,
        includeLinks: true,
        includePhotos: false
      });
    })
    .filter((place): place is Place => Boolean(place));
}

function sanitizeMemory(
  memory: MemoryEvent,
  options: MemoryShareOptions,
  people: Person[],
  places: Place[],
  photos: BackupPhotoRecord[]
): MemoryEvent {
  const allowedPersonIds = new Set(people.map((person) => person.id));
  const allowedPlaceIds = new Set(places.map((place) => place.id));
  const placeIds = options.placeMode === "hidden"
    ? []
    : getMemoryPlaceIds(memory).filter((placeId) => allowedPlaceIds.has(placeId));
  return {
    ...memory,
    content: options.includeContent ? memory.content : "",
    personIds: options.peopleMode === "hidden" ? [] : (memory.personIds || []).filter((personId) => allowedPersonIds.has(personId)),
    placeId: placeIds[0] || "",
    placeIds,
    photos: photos.map((photo) => photo.id)
  };
}

function sanitizePerson(person: Person, name: string): Person {
  return {
    id: person.id,
    name,
    nickname: "",
    relationship: person.relationship || "分享人物",
    birthday: "",
    birthdayIsLunar: false,
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [],
    notes: ""
  };
}

function sanitizePlace(place: Place, options: PlaceShareOptions): Place {
  return {
    ...place,
    rating: Number(place.rating) || 0,
    address: options.includeAddress ? place.address : "",
    latitude: options.includePreciseLocation ? place.latitude : undefined,
    longitude: options.includePreciseLocation ? place.longitude : undefined,
    mapUrl: options.includePreciseLocation ? place.mapUrl : "",
    sourceUrl: options.includeLinks ? place.sourceUrl : "",
    platformLinks: options.includeLinks ? place.platformLinks || [] : [],
    photos: options.includePhotos ? place.photos || [] : [],
    favorite: false
  };
}

function normalizeSharedPerson(value: unknown) {
  if (!isRecord(value)) return null;
  const id = String(value.id || "").trim();
  const name = String(value.name || "").trim();
  if (!id || !name) return null;
  return sanitizeIncomingPerson(value as unknown as Person);
}

function normalizeSharedPlace(value: unknown) {
  if (!isRecord(value)) return null;
  const id = String(value.id || "").trim();
  const name = String(value.name || "").trim();
  if (!id || !name) return null;
  return sanitizeIncomingPlace(value as unknown as Place);
}

function normalizeSharedMemory(value: unknown) {
  if (!isRecord(value)) return null;
  const id = String(value.id || "").trim();
  if (!id) return null;
  return {
    id,
    title: String(value.title || "分享的回忆"),
    date: normalizeDate(String(value.date || "")),
    personIds: Array.isArray(value.personIds) ? value.personIds.map(String).filter(Boolean) : [],
    placeId: String(value.placeId || ""),
    placeIds: Array.isArray(value.placeIds) ? value.placeIds.map(String).filter(Boolean) : [],
    mood: String(value.mood || "日常"),
    content: String(value.content || ""),
    tags: Array.isArray(value.tags) ? value.tags.map(String).filter(Boolean) : [],
    photos: Array.isArray(value.photos) ? value.photos.map(String).filter(Boolean) : []
  } satisfies MemoryEvent;
}

function sanitizeIncomingPerson(person: Person): Person {
  return {
    id: String(person.id || ""),
    name: String(person.name || "分享人物"),
    nickname: String(person.nickname || ""),
    relationship: String(person.relationship || "分享人物"),
    birthday: "",
    birthdayIsLunar: false,
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [],
    notes: ""
  };
}

function sanitizeIncomingPlace(place: Place): Place {
  return {
    id: String(place.id || ""),
    name: String(place.name || "分享地点"),
    country: String(place.country || "中国"),
    province: String(place.province || ""),
    city: String(place.city || ""),
    area: String(place.area || ""),
    mall: String(place.mall || ""),
    storeName: String(place.storeName || ""),
    category: String(place.category || "其他"),
    rating: Number(place.rating) || 0,
    address: String(place.address || ""),
    latitude: typeof place.latitude === "number" ? place.latitude : undefined,
    longitude: typeof place.longitude === "number" ? place.longitude : undefined,
    mapUrl: String(place.mapUrl || ""),
    sourceUrl: String(place.sourceUrl || ""),
    platformLinks: Array.isArray(place.platformLinks) ? place.platformLinks : [],
    photos: Array.isArray(place.photos) ? place.photos.map(String).filter(Boolean) : [],
    desc: String(place.desc || ""),
    tags: Array.isArray(place.tags) ? place.tags.map(String).filter(Boolean) : [],
    favorite: false
  };
}

function validateShareIntegrity(value: unknown, payload: LifeLogSharePayload) {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error("分享包完整性信息不正确。");
  const expected = payload.integrity;
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (Number(value[key]) !== expected[key]) {
      throw new Error("分享包完整性校验失败，请让对方重新导出分享包。");
    }
  }
}

function isBackupPhotoRecord(value: unknown): value is BackupPhotoRecord {
  if (!isRecord(value)) return false;
  return ["id", "memoryId", "originalDataUrl", "thumbnailDataUrl", "mimeType", "uploadedAt"].every((key) => typeof value[key] === "string");
}

function analyzeShareImport(payload: LifeLogSharePayload, state: LifeLogState) {
  const existingMemoryKeys = new Set(state.memories.map(buildMemoryDuplicateKey));
  let peopleToCreate = 0;
  let peopleToReuse = 0;
  let placesToCreate = 0;
  let placesToReuse = 0;
  let memoriesToCreate = 0;
  let memoriesToSkip = 0;
  const detail: LifeLogShareImportPreview["detail"] = {
    createPeople: [],
    reusePeople: [],
    createPlaces: [],
    reusePlaces: [],
    createMemories: [],
    skipMemories: [],
    missingFields: buildMissingShareFields(payload)
  };

  payload.data.people.forEach((person) => {
    if (findMatchingPerson(person, state.people)) {
      peopleToReuse += 1;
      detail.reusePeople.push(person.name);
    } else {
      peopleToCreate += 1;
      detail.createPeople.push(person.name);
    }
  });

  payload.data.places.forEach((place) => {
    const label = buildPlacePreviewLabel(place);
    if (findMatchingPlace(place, state.places)) {
      placesToReuse += 1;
      detail.reusePlaces.push(label);
    } else {
      placesToCreate += 1;
      detail.createPlaces.push(label);
    }
  });

  payload.data.memories.forEach((memory) => {
    const key = buildMemoryDuplicateKey(memory);
    if (existingMemoryKeys.has(key)) {
      memoriesToSkip += 1;
      detail.skipMemories.push(buildMemoryPreviewLabel(memory));
    }
    else {
      memoriesToCreate += 1;
      existingMemoryKeys.add(key);
      detail.createMemories.push(buildMemoryPreviewLabel(memory));
    }
  });

  return {
    peopleToCreate,
    peopleToReuse,
    placesToCreate,
    placesToReuse,
    memoriesToCreate,
    memoriesToSkip,
    detail: {
      createPeople: limitPreviewItems(detail.createPeople),
      reusePeople: limitPreviewItems(detail.reusePeople),
      createPlaces: limitPreviewItems(detail.createPlaces),
      reusePlaces: limitPreviewItems(detail.reusePlaces),
      createMemories: limitPreviewItems(detail.createMemories),
      skipMemories: limitPreviewItems(detail.skipMemories),
      missingFields: detail.missingFields
    }
  };
}

function buildMissingShareFields(payload: LifeLogSharePayload) {
  const missing = new Set<string>();
  if (payload.appVersion === "qr-mini-v1") {
    missing.add("完整正文");
    missing.add("照片");
    if (payload.data.places.length) {
      missing.add("详细地址");
      missing.add("外部链接");
      missing.add("精确定位");
    }
    return Array.from(missing);
  }

  if (payload.shareType === "memory" && payload.options.memory) {
    if (!payload.options.memory.includeContent) missing.add("完整正文");
    if (payload.options.memory.peopleMode === "hidden") missing.add("关联人物");
    if (payload.options.memory.peopleMode === "anonymous") missing.add("人物真实姓名");
    if (payload.options.memory.placeMode === "hidden") missing.add("关联地点");
    if (payload.options.memory.placeMode === "name") {
      missing.add("地点地址");
      missing.add("地点链接");
      missing.add("精确定位");
    }
    if (!payload.options.memory.includePhotos) missing.add("照片");
  }

  if (payload.shareType === "places" && payload.options.place) {
    if (!payload.options.place.includeAddress) missing.add("详细地址");
    if (!payload.options.place.includeLinks) missing.add("外部链接");
    if (!payload.options.place.includePreciseLocation) missing.add("精确定位");
    if (!payload.options.place.includePhotos) missing.add("照片");
  }

  return Array.from(missing);
}

function buildPlacePreviewLabel(place: Place) {
  return [place.name || place.storeName || "分享地点", place.mall, place.city].filter(Boolean).join(" · ");
}

function buildMemoryPreviewLabel(memory: MemoryEvent) {
  return [memory.title || "分享的回忆", normalizeDate(memory.date)].filter(Boolean).join(" · ");
}

function limitPreviewItems(items: string[], limit = 5) {
  const unique = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (unique.length <= limit) return unique;
  return [...unique.slice(0, limit), `还有 ${unique.length - limit} 项`];
}

function findMatchingPerson(incoming: Person, people: Person[]) {
  const name = normalizeText(incoming.name);
  if (!name) return null;
  return people.find((person) => normalizeText(person.name) === name || normalizeText(person.nickname || "") === name) || null;
}

function findMatchingPlace(incoming: Place, places: Place[]) {
  const name = normalizeText(incoming.name || incoming.storeName);
  const address = normalizeText(incoming.address);
  const city = normalizeText(incoming.city);
  const mall = normalizeText(incoming.mall);
  const storeName = normalizeText(incoming.storeName);

  return places.find((place) => {
    const sameName = normalizeText(place.name || place.storeName) === name;
    if (!sameName) return false;
    if (address && normalizeText(place.address) === address) return true;
    if (city && normalizeText(place.city) !== city) return false;
    if (mall && normalizeText(place.mall) === mall) return true;
    if (storeName && normalizeText(place.storeName) === storeName) return true;
    return !address && !mall && !storeName;
  }) || null;
}

function buildMemoryDuplicateKey(memory: MemoryEvent) {
  return [
    normalizeDate(memory.date),
    normalizeText(memory.title),
    normalizeText(memory.content).slice(0, 80)
  ].join("|");
}

function groupPhotoRecordsByMemoryId(records: BackupPhotoRecord[]) {
  const groups = new Map<string, BackupPhotoRecord[]>();
  records.forEach((record) => {
    const list = groups.get(record.memoryId) || [];
    list.push(record);
    groups.set(record.memoryId, list);
  });
  return groups;
}

async function restoreSharedPhoto(record: BackupPhotoRecord, memoryId: string, order: number): Promise<Photo> {
  return {
    id: uid("photo"),
    memoryId,
    originalBlob: await dataUrlToBlob(record.originalDataUrl),
    thumbnailBlob: await dataUrlToBlob(record.thumbnailDataUrl),
    width: Number(record.width) || 0,
    height: Number(record.height) || 0,
    fileSize: Number(record.fileSize) || 0,
    mimeType: record.mimeType || "image/jpeg",
    capturedAt: record.capturedAt,
    uploadedAt: record.uploadedAt || new Date().toISOString(),
    order: Number(record.order) || order
  };
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function normalizeText(value: string) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
