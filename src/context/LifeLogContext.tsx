import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  clearPlaceMergeHistory,
  deleteMemoryRecord,
  deletePersonRecord,
  deletePlaceRecord,
  loadAppSettings,
  loadPlaceMergeHistory,
  loadLifeLogState,
  loadPhotosByMemoryId,
  loadReminderSettings,
  normalizeState,
  replaceAllData,
  resetDatabase,
  runPlaceMergeTransaction,
  saveAppSettings,
  savePlaceMergeHistoryEntry,
  saveMemoryRecord,
  savePersonRecord,
  savePlaceRecord,
  savePhotoRecords,
  saveReminderSettings,
  deletePhotosByMemoryId
} from "../db/database";
import type {
  AppSettings,
  Anniversary,
  EntryType,
  LifeLogState,
  MemoryEvent,
  Person,
  Photo,
  Place,
  PlaceDuplicateGroup,
  PlaceMergeHistoryEntry,
  PlaceMergePreview,
  PlaceSaveInspection,
  PlaceSaveOptions,
  ReminderSettings
} from "../types";
import { defaultAppSettings, defaultReminderSettings } from "../types";
import { buildMemoryTitle, inferQuickMemory } from "../utils/memoryInference";
import { parsePlatformLinksText } from "../utils/placeLinks";
import { buildPlaceDisplayName, inferMallName, inferProvince, normalizeCityName, normalizePlaceText } from "../utils/placeMeta";
import {
  buildGroupMergePreview,
  findPlaceDuplicateGroups,
  inspectPlaceDuplicate,
  mergeMemoryPlaceReferences,
  mergePlaceRecords
} from "../utils/placeDedup";
import { parseGroups, splitLines, splitList } from "../utils/text";

interface LifeLogContextValue {
  state: LifeLogState;
  settings: AppSettings;
  reminderSettings: ReminderSettings;
  isLoading: boolean;
  savePerson: (formData: FormData, id?: string) => Promise<string>;
  togglePersonFavorite: (id: string) => Promise<void>;
  inspectPlaceSave: (formData: FormData, id?: string) => PlaceSaveInspection;
  savePlace: (formData: FormData, id?: string, options?: PlaceSaveOptions) => Promise<string>;
  togglePlaceFavorite: (id: string) => Promise<void>;
  saveMemory: (formData: FormData, id?: string, photos?: Photo[]) => Promise<string>;
  deleteEntry: (type: EntryType, id: string) => Promise<void>;
  importData: (file: File) => Promise<void>;
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  duplicatePlaceGroups: PlaceDuplicateGroup[];
  placeMergeHistory: PlaceMergeHistoryEntry[];
  latestPlaceMerge: PlaceMergeHistoryEntry | null;
  mergePlacePreview: (preview: PlaceMergePreview) => Promise<string>;
  mergeDuplicatePlaces: (group: PlaceDuplicateGroup) => Promise<void>;
  mergeAllDuplicatePlaces: () => Promise<number>;
  undoLatestPlaceMerge: () => Promise<boolean>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updateReminderSettings: (patch: Partial<ReminderSettings>) => Promise<void>;
  exportData: () => void;
  resetDemo: () => Promise<void>;
  loadMemoryPhotos: (memoryId: string) => Promise<Photo[]>;
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
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [placeMergeHistory, setPlaceMergeHistory] = useState<PlaceMergeHistoryEntry[]>([]);
  const favoritePendingRef = useRef({ people: new Set<string>(), places: new Set<string>() });

  useEffect(() => {
    let active = true;

    loadLifeLogState()
      .then(async (nextState) => {
        const nextSettings = await loadAppSettings();
        const nextReminderSettings = await loadReminderSettings();
        const mergeHistory = await loadPlaceMergeHistory();
        if (active) setState(nextState);
        if (active) setSettings(nextSettings);
        if (active) setReminderSettings(nextReminderSettings);
        if (active) setPlaceMergeHistory(mergeHistory);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const duplicatePlaceGroups = useMemo(
    () => findPlaceDuplicateGroups(state.places),
    [state.places]
  );

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
        relationship: String(formData.get("relationship") || settings.defaultRelationship),
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

    async function togglePersonFavorite(id: string) {
      if (favoritePendingRef.current.people.has(id)) return;
      const person = state.people.find((item) => item.id === id);
      if (!person) return;
      const next: Person = { ...person, favorite: !person.favorite };
      favoritePendingRef.current.people.add(id);
      setState((current) => ({
        ...current,
        people: current.people.map((item) => (item.id === id ? next : item))
      }));
      try {
        await savePersonRecord(next);
      } finally {
        favoritePendingRef.current.people.delete(id);
      }
    }

    async function togglePlaceFavorite(id: string) {
      if (favoritePendingRef.current.places.has(id)) return;
      const place = state.places.find((item) => item.id === id);
      if (!place) return;
      const next: Place = { ...place, favorite: !place.favorite };
      favoritePendingRef.current.places.add(id);
      setState((current) => ({
        ...current,
        places: current.places.map((item) => (item.id === id ? next : item))
      }));
      try {
        await savePlaceRecord(next);
      } finally {
        favoritePendingRef.current.places.delete(id);
      }
    }

    function inspectPlaceSave(formData: FormData, id?: string): PlaceSaveInspection {
      const existing = state.places.find((place) => place.id === id);
      const draft = buildPlaceFromFormData(formData, existing?.id, settings);
      if (existing) {
        return {
          resolution: "save",
          draft
        };
      }

      const preview = inspectPlaceDuplicate(draft, state.places);
      if (!preview) {
        return {
          resolution: "save",
          draft
        };
      }

      return {
        resolution: preview.strength === "strong" ? "auto-merge" : "confirm-merge",
        draft,
        preview
      };
    }

    async function savePlace(formData: FormData, id?: string, options?: PlaceSaveOptions) {
      const existing = state.places.find((place) => place.id === id);
      const inspection =
        !existing && !options?.skipDuplicateCheck && !options?.mergeTargetId ? inspectPlaceSave(formData, id) : null;
      const place = inspection?.draft || buildPlaceFromFormData(formData, existing?.id, settings);

      if (inspection?.resolution === "auto-merge" && inspection.preview) {
        return mergePlacePreview(inspection.preview);
      }

      if (!existing && options?.mergeTargetId) {
        const target = state.places.find((item) => item.id === options.mergeTargetId);
        if (target) {
          const preview: PlaceMergePreview = options.mergePreviewOverride || {
            signature: `manual|${target.id}|${place.id}`,
            reason: "手动确认合并",
            strength: "weak",
            canonical: target,
            sources: [place],
            details: ["已手动确认保留并合并这两条地点记录。"],
            merged: mergePlaceRecords(target, place)
          };
          return mergePlacePreview(preview);
        }
      }

      await savePlaceRecord(place);
      setState((current) => ({
        ...current,
        places: existing
          ? current.places.map((item) => (item.id === existing.id ? place : item))
          : [...current.places, place]
      }));

      return place.id;
    }

    async function saveMemory(formData: FormData, id?: string, photos?: Photo[]) {
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
      const memoryId = existing?.id || uid("m");
      const memory: MemoryEvent = {
        id: memoryId,
        title,
        date: memoryMode === "quick" && !existing ? quickInference.date : inputDate,
        personIds: matchedPersonIds,
        placeId: selectedPlaceId || (!existing ? quickInference.placeId : ""),
        mood: String(formData.get("mood") || settings.defaultMood),
        content,
        tags: splitList(formData.get("tags")),
        photos: photos ? photos.map((p) => p.id) : existing?.photos || []
      };

      await saveMemoryRecord(memory);

      // 保存照片到数据库
      if (photos && photos.length > 0) {
        await savePhotoRecords(photos);
      }

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
      let parsed: Partial<LifeLogState>;
      try {
        parsed = JSON.parse(text) as Partial<LifeLogState>;
      } catch {
        throw new Error("文件不是有效的 JSON 格式，请检查备份文件。");
      }
      if (!parsed || typeof parsed !== "object") {
        throw new Error("JSON 结构不正确，请使用 LifeLog 导出的备份文件。");
      }
      const next = normalizeState(parsed);
      await replaceAllData(next);
      await clearPlaceMergeHistory();
      setState(next);
      setPlaceMergeHistory([]);
    }

    function getPersonName(id: string) {
      return state.people.find((person) => person.id === id)?.name || "未关联人物";
    }

    function getPlaceName(id: string) {
      const place = state.places.find((item) => item.id === id);
      return place ? buildPlaceDisplayName(place) : "未关联地点";
    }

    async function mergeDuplicatePlaces(group: PlaceDuplicateGroup) {
      const preview = buildGroupMergePreview(group, state.places);
      if (!preview) return;
      await mergePlacePreview(preview);
    }

    async function mergeAllDuplicatePlaces() {
      const groups = findPlaceDuplicateGroups(state.places).filter((group) => group.strength === "strong");
      let workingPlaces = [...state.places];
      let workingMemories = [...state.memories];
      let mergedCount = 0;
      let mergedGroupCount = 0;
      const mergedPlaceIds = new Set<string>();

      for (const group of groups) {
        const preview = buildGroupMergePreview(group, workingPlaces);
        if (!preview) continue;

        const { nextState, removedIds } = resolvePlaceMerge(
          {
            ...state,
            places: workingPlaces,
            memories: workingMemories
          },
          preview
        );
        if (!removedIds.length) continue;

        workingPlaces = nextState.places;
        workingMemories = nextState.memories;
        mergedCount += removedIds.length;
        mergedGroupCount += 1;
        mergedPlaceIds.add(preview.canonical.id);
        preview.sources.forEach((source) => mergedPlaceIds.add(source.id));
      }

      if (!mergedCount) return 0;

      const keepIds = new Set(workingPlaces.map((place) => place.id));
      const removedIds = state.places.map((place) => place.id).filter((id) => !keepIds.has(id));
      const historyEntry = buildPlaceMergeHistoryEntry(
        state,
        {
          ...state,
          places: workingPlaces,
          memories: workingMemories
        },
        removedIds,
        {
          reason: `批量合并强重复地点（${mergedGroupCount}组）`,
          strength: "strong",
          placeIds: Array.from(mergedPlaceIds).sort()
        }
      );
      await runPlaceMergeTransaction(historyEntry.nextState, removedIds);
      await savePlaceMergeHistoryEntry(historyEntry.entry);
      const nextHistory = await loadPlaceMergeHistory();
      setState(historyEntry.nextState);
      setPlaceMergeHistory(nextHistory);
      return mergedCount;
    }

    async function mergePlacePreview(preview: PlaceMergePreview) {
      const { nextState, removedIds } = resolvePlaceMerge(state, preview);
      const { entry } = buildPlaceMergeHistoryEntry(state, nextState, removedIds, {
        reason: preview.reason,
        strength: preview.strength,
        placeIds: [preview.canonical.id, ...preview.sources.map((source) => source.id)]
      });
      await runPlaceMergeTransaction(nextState, removedIds);
      await savePlaceMergeHistoryEntry(entry);
      const nextHistory = await loadPlaceMergeHistory();
      setState(nextState);
      setPlaceMergeHistory(nextHistory);
      return preview.canonical.id;
    }

    async function undoLatestPlaceMerge() {
      const latestPlaceMerge = placeMergeHistory[0] || null;
      if (!latestPlaceMerge) return false;
      await replaceAllData(latestPlaceMerge.snapshot);
      const remainingHistory = placeMergeHistory.slice(1);
      await clearPlaceMergeHistory();
      for (const entry of remainingHistory.slice().reverse()) {
        await savePlaceMergeHistoryEntry(entry, 20);
      }
      setState(latestPlaceMerge.snapshot);
      setPlaceMergeHistory(remainingHistory);
      return true;
    }

    async function updateSettings(patch: Partial<AppSettings>) {
      const next = {
        ...settings,
        ...Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, String(value || "").trim()])
        ),
      };
      const normalized: AppSettings = {
        defaultCity: next.defaultCity || defaultAppSettings.defaultCity,
        defaultRelationship: next.defaultRelationship || defaultAppSettings.defaultRelationship,
        defaultMood: next.defaultMood || defaultAppSettings.defaultMood
      };
      await saveAppSettings(normalized);
      setSettings(normalized);
    }

    async function updateReminderSettings(patch: Partial<ReminderSettings>) {
      const next = {
        ...reminderSettings,
        ...patch
      };
      await saveReminderSettings(next);
      setReminderSettings(next);
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
      await clearPlaceMergeHistory();
      const next = await loadLifeLogState();
      setState(next);
      setPlaceMergeHistory([]);
    }

    const latestPlaceMerge = placeMergeHistory[0] || null;

    async function loadMemoryPhotos(memoryId: string): Promise<Photo[]> {
      return await loadPhotosByMemoryId(memoryId);
    }

    return {
      state,
      settings,
      reminderSettings,
      isLoading,
      savePerson,
      togglePersonFavorite,
      inspectPlaceSave,
      savePlace,
      togglePlaceFavorite,
      saveMemory,
      deleteEntry,
      importData,
      getPersonName,
      getPlaceName,
      duplicatePlaceGroups,
      placeMergeHistory,
      latestPlaceMerge,
      mergePlacePreview,
      mergeDuplicatePlaces,
      mergeAllDuplicatePlaces,
      undoLatestPlaceMerge,
      updateSettings,
      updateReminderSettings,
      exportData,
      resetDemo,
      loadMemoryPhotos
    };
  }, [duplicatePlaceGroups, isLoading, placeMergeHistory, settings, reminderSettings, state]);

  return <LifeLogContext.Provider value={value}>{children}</LifeLogContext.Provider>;
}

function buildPlaceFromFormData(formData: FormData, id: string | undefined, settings: AppSettings): Place {
  const country = normalizePlaceText(formData.get("country")) || "中国";
  const province = normalizePlaceText(formData.get("province"));
  const city = normalizeCityName(normalizePlaceText(formData.get("city")) || settings.defaultCity);
  const address = normalizePlaceText(formData.get("address"));
  const mall = normalizePlaceText(formData.get("mall")) || inferMallName(address);

  return {
    id: id || uid("l"),
    name: String(formData.get("name") || "未命名地点"),
    country,
    province: inferProvince({
      country,
      province,
      city,
      address
    }),
    city,
    area: String(formData.get("area") || ""),
    mall,
    storeName: String(formData.get("storeName") || ""),
    category: String(formData.get("category") || "其他"),
    rating: Number(formData.get("rating")) || 4,
    address,
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
}

function resolvePlaceMerge(state: LifeLogState, preview: PlaceMergePreview) {
  const existingIds = new Set(state.places.map((place) => place.id));
  const removedIds = preview.sources
    .map((source) => source.id)
    .filter((id) => existingIds.has(id) && id !== preview.canonical.id);

  const nextMemories = removedIds.reduce(
    (current, sourceId) => mergeMemoryPlaceReferences(current, sourceId, preview.canonical.id),
    state.memories
  );
  const nextPlaces = state.places
    .filter((place) => !removedIds.includes(place.id))
    .map((place) => (place.id === preview.canonical.id ? preview.merged : place));

  return {
    nextState: {
      ...state,
      places: nextPlaces,
      memories: nextMemories
    },
    removedIds
  };
}

function buildPlaceMergeHistoryEntry(
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
        memories: [...snapshotState.memories]
      }
    },
    nextState,
    removedIds
  };
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
