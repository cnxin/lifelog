import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  deleteMemoryRecord,
  deletePersonRecord,
  deletePlaceRecord,
  loadLifeLogState,
  normalizeState,
  replaceAllData,
  resetDatabase,
  saveMemoryRecord,
  savePersonRecord,
  savePlaceRecord
} from "../db/database";
import type { Anniversary, EntryType, LifeLogState, MemoryEvent, Person, Place } from "../types";
import { buildMemoryTitle, inferQuickMemory } from "../utils/memoryInference";
import { parsePlatformLinksText } from "../utils/placeLinks";
import { parseGroups, splitLines, splitList } from "../utils/text";

interface LifeLogContextValue {
  state: LifeLogState;
  isLoading: boolean;
  savePerson: (formData: FormData, id?: string) => Promise<string>;
  savePlace: (formData: FormData, id?: string) => Promise<string>;
  saveMemory: (formData: FormData, id?: string) => Promise<string>;
  deleteEntry: (type: EntryType, id: string) => Promise<void>;
  importData: (file: File) => Promise<void>;
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  exportData: () => void;
  resetDemo: () => Promise<void>;
}

const emptyState: LifeLogState = {
  people: [],
  places: [],
  memories: []
};

const LifeLogContext = createContext<LifeLogContextValue | null>(null);

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function LifeLogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LifeLogState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    loadLifeLogState()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<LifeLogContextValue>(() => {
    async function savePerson(formData: FormData, id?: string) {
      const existing = state.people.find((person) => person.id === id);
      const birthday = buildDate(
        formData.get("birthdayYear"),
        formData.get("birthdayMonth"),
        formData.get("birthdayDay")
      );
      const anniversaries = mergeBirthdayAnniversary(
        birthday,
        parseAnniversaries(formData.get("anniversaries"))
      );

      const person: Person = {
        id: existing?.id || uid("p"),
        name: String(formData.get("name") || "未命名"),
        nickname: String(formData.get("nickname") || ""),
        relationship: String(formData.get("relationship") || "朋友"),
        birthday,
        birthdayIsLunar: false,
        favorite: formData.get("favorite") === "true",
        preferences: parseGroups(formData.get("preferences")),
        dislikes: parseGroups(formData.get("dislikes")),
        anniversaries,
        notes: String(formData.get("notes") || "")
      };

      await savePersonRecord(person);
      setState((current) => ({
        ...current,
        people: existing
          ? current.people.map((item) => (item.id === existing.id ? person : item))
          : [...current.people, person]
      }));

      return person.id;
    }

    async function savePlace(formData: FormData, id?: string) {
      const existing = state.places.find((place) => place.id === id);
      const place: Place = {
        id: existing?.id || uid("l"),
        name: String(formData.get("name") || "未命名地点"),
        country: String(formData.get("country") || "中国"),
        city: String(formData.get("city") || "杭州"),
        area: String(formData.get("area") || ""),
        storeName: String(formData.get("storeName") || ""),
        category: String(formData.get("category") || "其他"),
        rating: Number(formData.get("rating")) || 4,
        address: String(formData.get("address") || ""),
        latitude: Number(formData.get("latitude")) || undefined,
        longitude: Number(formData.get("longitude")) || undefined,
        mapUrl: String(formData.get("mapUrl") || ""),
        sourceUrl: String(formData.get("sourceUrl") || ""),
        platformLinks: parsePlatformLinksText(formData.get("platformLinks")),
        photos: splitLines(formData.get("photos")),
        desc: String(formData.get("desc") || ""),
        tags: splitList(formData.get("tags")),
        favorite: formData.get("favorite") === "true"
      };

      await savePlaceRecord(place);
      setState((current) => ({
        ...current,
        places: existing
          ? current.places.map((item) => (item.id === existing.id ? place : item))
          : [...current.places, place]
      }));

      return place.id;
    }

    async function saveMemory(formData: FormData, id?: string) {
      const existing = state.memories.find((memory) => memory.id === id);
      const selectedPersonIds = formData
        .getAll("personIds")
        .map((item) => String(item))
        .filter(Boolean);
      const legacyPersonId = String(formData.get("personId") || "");
      const content = String(formData.get("content") || "");
      const title = buildMemoryTitle(String(formData.get("title") || ""), content);
      const memoryMode = String(formData.get("memoryMode") || "");
      const selectedPlaceId = String(formData.get("placeId") || "");
      const inputDate = String(formData.get("date") || new Date().toISOString().slice(0, 10));
      const quickInference = inferQuickMemory({
        rawTitle: String(formData.get("title") || ""),
        content,
        people: state.people,
        places: state.places,
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
      const memory: MemoryEvent = {
        id: existing?.id || uid("m"),
        title,
        date: memoryMode === "quick" && !existing ? quickInference.date : inputDate,
        personIds: matchedPersonIds,
        placeId: selectedPlaceId || (!existing ? quickInference.placeId : ""),
        mood: String(formData.get("mood") || "平静"),
        content,
        tags: splitList(formData.get("tags"))
      };

      await saveMemoryRecord(memory);
      setState((current) => ({
        ...current,
        memories: existing
          ? current.memories.map((item) => (item.id === existing.id ? memory : item))
          : [...current.memories, memory]
      }));

      return memory.id;
    }

    async function deleteEntry(type: EntryType, id: string) {
      if (type === "person") {
        await deletePersonRecord(id);
        setState((current) => ({
          ...current,
          people: current.people.filter((person) => person.id !== id),
          memories: current.memories.map((memory) => ({
            ...memory,
            personIds: memory.personIds.filter((personId) => personId !== id)
          }))
        }));
        return;
      }

      if (type === "place") {
        await deletePlaceRecord(id);
        setState((current) => ({
          ...current,
          places: current.places.filter((place) => place.id !== id),
          memories: current.memories.map((memory) => ({
            ...memory,
            placeId: memory.placeId === id ? "" : memory.placeId
          }))
        }));
        return;
      }

      await deleteMemoryRecord(id);
      setState((current) => ({
        ...current,
        memories: current.memories.filter((memory) => memory.id !== id)
      }));
    }

    async function importData(file: File) {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<LifeLogState>;
      const next = normalizeState(parsed);
      await replaceAllData(next);
      setState(next);
    }

    function getPersonName(id: string) {
      return state.people.find((person) => person.id === id)?.name || "未关联人物";
    }

    function getPlaceName(id: string) {
      return state.places.find((place) => place.id === id)?.name || "未关联地点";
    }

    function exportData() {
      const payload = {
        version: 2,
        storage: "indexeddb",
        exportedAt: new Date().toISOString(),
        ...state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lifelog-indexeddb-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }

    async function resetDemo() {
      await resetDatabase();
      const next = await loadLifeLogState();
      setState(next);
    }

    return {
      state,
      isLoading,
      savePerson,
      savePlace,
      saveMemory,
      deleteEntry,
      importData,
      getPersonName,
      getPlaceName,
      exportData,
      resetDemo
    };
  }, [isLoading, state]);

  return <LifeLogContext.Provider value={value}>{children}</LifeLogContext.Provider>;
}

function buildDate(
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

function parseAnniversaries(value: FormDataEntryValue | null): Anniversary[] {
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

function mergeBirthdayAnniversary(birthday: string, anniversaries: Anniversary[]) {
  const custom = anniversaries.filter((item) => item.title !== "生日");
  if (!birthday) return custom;
  return [{ title: "生日", date: birthday }, ...custom];
}

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function useLifeLog() {
  const context = useContext(LifeLogContext);
  if (!context) {
    throw new Error("useLifeLog must be used inside LifeLogProvider");
  }
  return context;
}
