import Dexie, { type Table } from "dexie";
import { seedData } from "../data/seedData";
import type { LifeLogState, MemoryEvent, Person, Place, PreferenceGroup } from "../types";
import { normalizePlacePlatformLinks } from "../utils/placeLinks";
import { inferMallName, inferProvince, normalizeCityName } from "../utils/placeMeta";

const LEGACY_STORAGE_KEY = "lifelog-react-state-v1";

class LifeLogDatabase extends Dexie {
  people!: Table<Person, string>;
  places!: Table<Place, string>;
  memories!: Table<MemoryEvent, string>;

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
  }
}

export const db = new LifeLogDatabase();

export async function loadLifeLogState(): Promise<LifeLogState> {
  await initializeDatabase();
  return readAll();
}

export async function savePersonRecord(person: Person) {
  await db.people.put(person);
}

export async function savePlaceRecord(place: Place) {
  await db.places.put(place);
}

export async function saveMemoryRecord(memory: MemoryEvent) {
  await db.memories.put(memory);
}

export async function deletePersonRecord(id: string) {
  await db.transaction("rw", db.people, db.memories, async () => {
    await db.people.delete(id);
    const memories = await db.memories.toArray();
    await Promise.all(
      memories.map((memory) =>
        db.memories.put({
          ...memory,
          personIds: memory.personIds.filter((personId) => personId !== id)
        })
      )
    );
  });
}

export async function deletePlaceRecord(id: string) {
  await db.transaction("rw", db.places, db.memories, async () => {
    await db.places.delete(id);
    const memories = await db.memories.toArray();
    await Promise.all(
      memories.map((memory) =>
        db.memories.put({
          ...memory,
          placeId: memory.placeId === id ? "" : memory.placeId
        })
      )
    );
  });
}

export async function deleteMemoryRecord(id: string) {
  await db.memories.delete(id);
}

export async function replaceAllData(input: Partial<LifeLogState>) {
  const next = normalizeState(input);
  await db.transaction("rw", db.people, db.places, db.memories, async () => {
    await db.people.clear();
    await db.places.clear();
    await db.memories.clear();
    await db.people.bulkPut(next.people);
    await db.places.bulkPut(next.places);
    await db.memories.bulkPut(next.memories);
  });
}

export async function resetDatabase() {
  await replaceAllData(seedData);
}

async function initializeDatabase() {
  const count = await db.people.count();
  if (count > 0) return;

  const legacy = readLegacyState();
  await replaceAllData(legacy || seedData);
}

async function readAll(): Promise<LifeLogState> {
  const [people, places, memories] = await Promise.all([
    db.people.toArray(),
    db.places.toArray(),
    db.memories.toArray()
  ]);

  return normalizeState({ people, places, memories });
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
  return {
    people: (input.people || seedData.people).map((person) => ({
      ...person,
      birthdayIsLunar: false,
      preferences: normalizeGroups((person as unknown as { preferences: unknown }).preferences, "喜好"),
      dislikes: normalizeGroups((person as unknown as { dislikes: unknown }).dislikes, "禁忌")
    })) as Person[],
    places: (input.places || seedData.places).map((place) => ({
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
      mall: (place as Place).mall || inferMallName(place.address || "") || place.area || "",
      storeName: place.storeName || "",
      address: place.address || "",
      latitude: place.latitude,
      longitude: place.longitude,
      mapUrl: place.mapUrl || "",
      sourceUrl: place.sourceUrl || "",
      platformLinks: normalizePlacePlatformLinks(place.platformLinks),
      photos: Array.isArray(place.photos) ? place.photos.filter(Boolean).map(String) : []
    })) as Place[],
    memories: (input.memories || seedData.memories) as MemoryEvent[]
  };
}
