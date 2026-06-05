import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { APP_VERSION } from "../constants/version";
import {
  clearPlaceMergeHistory,
  deleteMemoryRecord,
  deletePersonRecord,
  deletePlaceRecord,
  loadAllPhotos,
  loadAppSettings,
  loadPlaceMergeHistory,
  loadLifeLogState,
  loadNotionSettings,
  loadNotionPageMappings,
  loadPhotosByIds,
  loadPhotosByMemoryId,
  loadReminderSettings,
  replaceAllBackupData,
  replaceAllData,
  resetDatabase,
  runPlaceMergeTransaction,
  deleteAnniversaryPlanRecord,
  deletePhotoRecords,
  saveAnniversaryPlanRecord,
  saveAppSettings,
  savePlaceMergeHistoryEntry,
  saveMemoryRecord,
  savePersonRecord,
  savePlaceRecord,
  savePlaceRecords,
  savePhotoRecords,
  saveReminderSettings,
  saveNotionSettings,
  saveNotionPageMappings,
  deletePhotosByMemoryId
} from "../db/database";
import type {
  AnniversaryPlan,
  AppSettings,
  EntryType,
  LifeLogState,
  MemoryEvent,
  NotionPageMapping,
  NotionSettings,
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
import { defaultAppSettings, defaultNotionSettings, defaultReminderSettings } from "../types";
import { buildPlaceDisplayName } from "../utils/placeMeta";
import {
  buildGroupMergePreview,
  findPlaceDuplicateGroups,
  inspectPlaceDuplicate,
  mergePlaceRecords
} from "../utils/placeDedup";
import { parseGroups } from "../utils/text";
import {
  buildDate,
  buildMemoryFromFormData,
  buildPlaceFromFormData,
  buildPlaceMergeHistoryEntry,
  isRecord,
  mergeBirthdayAnniversary,
  parseAnniversaries,
  resolvePlaceMerge,
  uid
} from "../utils/lifelogHelpers";
import {
  normalizeBackupPayload,
  serializeBackupPhoto,
  type FullBackupPayload
} from "../utils/lifelogBackup";
import {
  buildMemorySharePayload,
  buildPlacesSharePayload,
  buildShareFileName,
  buildShareImportPlan,
  type LifeLogShareImportResult,
  type LifeLogSharePayload,
  type MemoryShareOptions,
  type PlaceShareOptions
} from "../utils/lifelogShare";
import { getMemoryPlaceIds, removeMemoryPlaceId } from "../utils/memoryPlaces";
import { saveBackupFile, type BackupExportTarget } from "../utils/backupExport";
import { syncLifeLogToNotion, type NotionSyncSummary } from "../utils/notionSync";

type DeletedEntrySnapshot =
  | { type: "person"; person: Person; affectedMemories: MemoryEvent[]; affectedPlans: AnniversaryPlan[] }
  | { type: "place"; place: Place; affectedMemories: MemoryEvent[]; affectedPlans: AnniversaryPlan[] }
  | { type: "memory"; memory: MemoryEvent; photos: Photo[] };

type BackupExportResult = BackupExportTarget;
type BackupImportOptions = { safeMode?: boolean };
type PlaceBulkPatch = Partial<Pick<Place, "category" | "mall" | "area">> & { appendTags?: string[] };
type PlaceBulkSnapshot = Pick<Place, "id" | "category" | "mall" | "area" | "tags">;

interface LifeLogContextValue {
  state: LifeLogState;
  settings: AppSettings;
  reminderSettings: ReminderSettings;
  notionSettings: NotionSettings;
  notionPageMappings: NotionPageMapping[];
  isLoading: boolean;
  savePerson: (formData: FormData, id?: string) => Promise<string>;
  updatePersonProfile: (id: string, patch: Pick<Person, "preferences" | "dislikes">) => Promise<void>;
  togglePersonFavorite: (id: string) => Promise<void>;
  saveAnniversaryPlan: (plan: AnniversaryPlan) => Promise<string>;
  deleteAnniversaryPlan: (id: string) => Promise<void>;
  inspectPlaceSave: (formData: FormData, id?: string) => PlaceSaveInspection;
  savePlace: (formData: FormData, id?: string, options?: PlaceSaveOptions) => Promise<string>;
  updatePlacesBulk: (placeIds: string[], patch: PlaceBulkPatch) => Promise<{ count: number; before: PlaceBulkSnapshot[] }>;
  restorePlacesBulk: (snapshots: PlaceBulkSnapshot[]) => Promise<number>;
  togglePlaceFavorite: (id: string) => Promise<void>;
  saveMemory: (formData: FormData, id?: string, photos?: Photo[]) => Promise<string>;
  deleteEntry: (type: EntryType, id: string) => Promise<void>;
  restoreDeletedEntry: (snapshot: DeletedEntrySnapshot) => Promise<void>;
  getDeleteSnapshot: (type: EntryType, id: string) => Promise<DeletedEntrySnapshot | null>;
  importData: (file: File, options?: BackupImportOptions) => Promise<string[]>;
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
  updateNotionSettings: (patch: Partial<NotionSettings>) => Promise<void>;
  syncNotionAll: () => Promise<NotionSyncSummary>;
  exportData: () => Promise<BackupExportResult>;
  buildMemoryShare: (memoryId: string, options: MemoryShareOptions) => Promise<LifeLogSharePayload>;
  buildPlacesShare: (placeIds: string[], options: PlaceShareOptions) => Promise<LifeLogSharePayload>;
  exportMemoryShare: (memoryId: string, options: MemoryShareOptions) => Promise<BackupExportResult>;
  exportPlacesShare: (placeIds: string[], options: PlaceShareOptions) => Promise<BackupExportResult>;
  importShareData: (payload: LifeLogSharePayload) => Promise<LifeLogShareImportResult>;
  undoShareImport: (result: LifeLogShareImportResult) => Promise<void>;
  resetDemo: () => Promise<void>;
  loadMemoryPhotos: (memoryId: string, photoIds?: string[]) => Promise<Photo[]>;
}

const emptyState: LifeLogState = {
  people: [],
  places: [],
  memories: [],
  anniversaryPlans: []
};

const LifeLogContext = createContext<LifeLogContextValue | null>(null);

export function LifeLogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LifeLogState>(emptyState);
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [notionSettings, setNotionSettings] = useState<NotionSettings>(defaultNotionSettings);
  const [notionPageMappings, setNotionPageMappings] = useState<NotionPageMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [placeMergeHistory, setPlaceMergeHistory] = useState<PlaceMergeHistoryEntry[]>([]);
  const favoritePendingRef = useRef({ people: new Set<string>(), places: new Set<string>() });

  useEffect(() => {
    let active = true;

    loadLifeLogState()
      .then(async (nextState) => {
        const nextSettings = await loadAppSettings();
        const nextReminderSettings = await loadReminderSettings();
        const nextNotionSettings = await loadNotionSettings();
        const nextNotionPageMappings = await loadNotionPageMappings();
        const mergeHistory = await loadPlaceMergeHistory();
        if (active) setState(nextState);
        if (active) setSettings(nextSettings);
        if (active) setReminderSettings(nextReminderSettings);
        if (active) setNotionSettings(nextNotionSettings);
        if (active) setNotionPageMappings(nextNotionPageMappings);
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

    async function updatePersonProfile(id: string, patch: Pick<Person, "preferences" | "dislikes">) {
      const person = state.people.find((item) => item.id === id);
      if (!person) throw new Error("没有找到这个人物。");
      const next: Person = {
        ...person,
        preferences: patch.preferences,
        dislikes: patch.dislikes
      };
      await savePersonRecord(next);
      setState((current) => ({
        ...current,
        people: current.people.map((item) => (item.id === id ? next : item))
      }));
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

    async function updatePlacesBulk(placeIds: string[], patch: PlaceBulkPatch) {
      const targetIds = new Set(placeIds);
      if (!targetIds.size) return { count: 0, before: [] };

      const category = patch.category?.trim();
      const mall = patch.mall?.trim();
      const area = patch.area?.trim();
      const appendTags = Array.from(new Set((patch.appendTags || []).map((tag) => tag.trim()).filter(Boolean)));
      if (!category && !mall && !area && !appendTags.length) return { count: 0, before: [] };
      const before = state.places
        .filter((place) => targetIds.has(place.id))
        .map((place) => ({
          id: place.id,
          category: place.category,
          mall: place.mall,
          area: place.area,
          tags: [...place.tags]
        }));

      const nextPlaces = state.places.map((place) => {
        if (!targetIds.has(place.id)) return place;
        return {
          ...place,
          category: category || place.category,
          mall: mall || place.mall,
          area: area || place.area,
          tags: appendTags.length ? Array.from(new Set([...place.tags, ...appendTags])) : place.tags
        };
      });
      const changedPlaces = nextPlaces.filter((place) => targetIds.has(place.id));
      if (!changedPlaces.length) return { count: 0, before: [] };

      await savePlaceRecords(changedPlaces);
      setState((current) => ({
        ...current,
        places: current.places.map((place) => nextPlaces.find((item) => item.id === place.id) || place)
      }));
      return { count: changedPlaces.length, before };
    }

    async function restorePlacesBulk(snapshots: PlaceBulkSnapshot[]) {
      if (!snapshots.length) return 0;
      const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
      const restoredPlaces = state.places
        .filter((place) => snapshotById.has(place.id))
        .map((place) => {
          const snapshot = snapshotById.get(place.id)!;
          return {
            ...place,
            category: snapshot.category,
            mall: snapshot.mall,
            area: snapshot.area,
            tags: [...snapshot.tags]
          };
        });
      if (!restoredPlaces.length) return 0;

      await savePlaceRecords(restoredPlaces);
      setState((current) => ({
        ...current,
        places: current.places.map((place) => restoredPlaces.find((item) => item.id === place.id) || place)
      }));
      return restoredPlaces.length;
    }

    async function saveMemory(formData: FormData, id?: string, photos?: Photo[]) {
      const existing = state.memories.find((memory) => memory.id === id);
      const memory = buildMemoryFromFormData({
        formData,
        existing,
        people: state.people,
        places: state.places,
        settings,
        photoIds: photos ? photos.map((p) => p.id) : undefined
      });
      const memoryId = memory.id;

      await saveMemoryRecord(memory);

      if (photos) {
        await deletePhotosByMemoryId(memoryId);
        if (photos.length > 0) {
          await savePhotoRecords(photos);
        }
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
          anniversaryPlans: current.anniversaryPlans.filter((plan) => plan.personId !== id),
          memories: current.memories.map((memory) => ({
            ...memory,
            personIds: (memory.personIds || []).filter((personId) => personId !== id)
          }))
        }));
        return;
      }

      if (type === "place") {
        await deletePlaceRecord(id);
        setState((current) => ({
          ...current,
          places: current.places.filter((place) => place.id !== id),
          anniversaryPlans: current.anniversaryPlans.map((plan) => ({
            ...plan,
            placeIds: (plan.placeIds || []).filter((placeId) => placeId !== id)
          })),
          memories: current.memories.map((memory) => removeMemoryPlaceId(memory, id))
        }));
        return;
      }

      await deleteMemoryRecord(id);
      setState((current) => ({
        ...current,
        memories: current.memories.filter((memory) => memory.id !== id),
        anniversaryPlans: current.anniversaryPlans.map((plan) => (plan.memoryId === id ? { ...plan, memoryId: undefined } : plan))
      }));
    }

    async function saveAnniversaryPlan(plan: AnniversaryPlan) {
      await saveAnniversaryPlanRecord(plan);
      setState((current) => ({
        ...current,
        anniversaryPlans: current.anniversaryPlans.some((item) => item.id === plan.id)
          ? current.anniversaryPlans.map((item) => (item.id === plan.id ? plan : item))
          : [...current.anniversaryPlans, plan]
      }));
      return plan.id;
    }

    async function deleteAnniversaryPlan(id: string) {
      await deleteAnniversaryPlanRecord(id);
      setState((current) => ({
        ...current,
        anniversaryPlans: current.anniversaryPlans.filter((plan) => plan.id !== id)
      }));
    }

    async function getDeleteSnapshot(type: EntryType, id: string): Promise<DeletedEntrySnapshot | null> {
      if (type === "person") {
        const person = state.people.find((item) => item.id === id);
        if (!person) return null;
        return {
          type: "person",
          person,
          affectedMemories: state.memories.filter((memory) => (memory.personIds || []).includes(id)),
          affectedPlans: state.anniversaryPlans.filter((plan) => plan.personId === id)
        };
      }

      if (type === "place") {
        const place = state.places.find((item) => item.id === id);
        if (!place) return null;
        return {
          type: "place",
          place,
          affectedMemories: state.memories.filter((memory) => getMemoryPlaceIds(memory).includes(id)),
          affectedPlans: state.anniversaryPlans.filter((plan) => (plan.placeIds || []).includes(id))
        };
      }

      const memory = state.memories.find((item) => item.id === id);
      if (!memory) return null;
      return {
        type: "memory",
        memory,
        photos: await loadMemoryPhotos(memory.id, memory.photos || [])
      };
    }

    async function restoreDeletedEntry(snapshot: DeletedEntrySnapshot) {
      if (snapshot.type === "person") {
        await savePersonRecord(snapshot.person);
        await Promise.all(snapshot.affectedMemories.map(saveMemoryRecord));
        await Promise.all(snapshot.affectedPlans.map(saveAnniversaryPlanRecord));
        setState((current) => ({
          ...current,
          people: current.people.some((person) => person.id === snapshot.person.id)
            ? current.people.map((person) => (person.id === snapshot.person.id ? snapshot.person : person))
            : [...current.people, snapshot.person],
          anniversaryPlans: restorePlanList(current.anniversaryPlans, snapshot.affectedPlans),
          memories: restoreMemoryList(current.memories, snapshot.affectedMemories)
        }));
        return;
      }

      if (snapshot.type === "place") {
        await savePlaceRecord(snapshot.place);
        await Promise.all(snapshot.affectedMemories.map(saveMemoryRecord));
        await Promise.all(snapshot.affectedPlans.map(saveAnniversaryPlanRecord));
        setState((current) => ({
          ...current,
          places: current.places.some((place) => place.id === snapshot.place.id)
            ? current.places.map((place) => (place.id === snapshot.place.id ? snapshot.place : place))
            : [...current.places, snapshot.place],
          anniversaryPlans: restorePlanList(current.anniversaryPlans, snapshot.affectedPlans),
          memories: restoreMemoryList(current.memories, snapshot.affectedMemories)
        }));
        return;
      }

      await saveMemoryRecord(snapshot.memory);
      if (snapshot.photos.length) await savePhotoRecords(snapshot.photos);
      setState((current) => ({
        ...current,
        memories: current.memories.some((memory) => memory.id === snapshot.memory.id)
          ? current.memories.map((memory) => (memory.id === snapshot.memory.id ? snapshot.memory : memory))
          : [...current.memories, snapshot.memory]
      }));
    }

    async function importData(file: File, options: BackupImportOptions = {}) {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error("文件不是有效的 JSON 格式，请检查备份文件。");
      }
      if (!isRecord(parsed)) {
        throw new Error("JSON 结构不正确，请使用 LifeLog 导出的备份文件。");
      }

      const backup = await normalizeBackupPayload(parsed, options);
      const next = await replaceAllBackupData(backup);
      setState(next);
      setSettings(backup.settings);
      setReminderSettings(backup.reminderSettings);
      setPlaceMergeHistory(backup.placeMergeHistory);
      return backup.warnings;
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
        defaultMood: next.defaultMood || defaultAppSettings.defaultMood,
        themeStyle: ["classic", "cream", "mint", "mist"].includes(next.themeStyle)
          ? next.themeStyle
          : defaultAppSettings.themeStyle,
        privacyMode: Boolean(next.privacyMode),
        hidePhotoThumbnails: Boolean(next.hidePhotoThumbnails)
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

    async function updateNotionSettings(patch: Partial<NotionSettings>) {
      const next: NotionSettings = {
        ...notionSettings,
        ...patch
      };
      await saveNotionSettings(next);
      setNotionSettings({
        ...defaultNotionSettings,
        ...next,
        enabled: Boolean(next.enabled && next.token.trim())
      });
    }

    async function syncNotionAll() {
      const result = await syncLifeLogToNotion({
        state,
        settings: notionSettings,
        mappings: notionPageMappings
      });
      if (result.mappings.length) {
        await saveNotionPageMappings(result.mappings);
        setNotionPageMappings((current) => mergeById(current, result.mappings));
      }
      const syncedAt = new Date().toISOString();
      const nextSettings = {
        ...notionSettings,
        workspaceName: result.workspaceName || notionSettings.workspaceName,
        workspaceBotName: result.workspaceBotName || notionSettings.workspaceBotName,
        lastFullSyncAt: syncedAt,
        lastConnectionStatus: result.failed ? "failed" as const : "connected" as const,
        lastConnectionMessage: result.failed
          ? `Notion 同步完成，失败 ${result.failed} 条。`
          : `Notion 同步完成，成功 ${result.synced} 条。`
      };
      await saveNotionSettings(nextSettings);
      setNotionSettings(nextSettings);
      return result;
    }

    async function exportData(): Promise<BackupExportResult> {
      const photos = await loadAllPhotos();
      const photoOwnerById = new Map<string, string>();
      state.memories.forEach((memory) => {
        (memory.photos || []).forEach((photoId) => {
          if (!photoOwnerById.has(photoId)) photoOwnerById.set(photoId, memory.id);
        });
      });
      const stateMemoryIds = new Set(state.memories.map((memory) => memory.id));
      const normalizedPhotos = photos
        .map((photo) => {
          const memoryId = stateMemoryIds.has(photo.memoryId) ? photo.memoryId : photoOwnerById.get(photo.id);
          return memoryId ? { ...photo, memoryId } : null;
        })
        .filter((photo): photo is Photo => Boolean(photo));
      const validPhotoIds = new Set(normalizedPhotos.map((photo) => photo.id));
      const exportState: LifeLogState = {
        ...state,
        memories: state.memories.map((memory) => ({
          ...memory,
          photos: Array.from(
            new Set([
              ...(memory.photos || []).filter((photoId) => validPhotoIds.has(photoId)),
              ...normalizedPhotos.filter((photo) => photo.memoryId === memory.id).map((photo) => photo.id)
            ])
          )
        }))
      };
      const backupPhotos = await Promise.all(normalizedPhotos.map(serializeBackupPhoto));
      const fileName = `lifelog-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const payload: FullBackupPayload = {
        schemaVersion: 3,
        version: 3,
        storage: "indexeddb",
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data: exportState,
        settings,
        reminderSettings,
        placeMergeHistory,
        photos: backupPhotos,
        integrity: {
          people: exportState.people.length,
          places: exportState.places.length,
          memories: exportState.memories.length,
          anniversaryPlans: exportState.anniversaryPlans.length,
          photos: backupPhotos.length
        }
      };
      return saveBackupFile(fileName, JSON.stringify(payload, null, 2));
    }

    async function buildMemoryShare(memoryId: string, options: MemoryShareOptions): Promise<LifeLogSharePayload> {
      const memory = state.memories.find((item) => item.id === memoryId);
      if (!memory) throw new Error("没有找到要分享的回忆。");
      const photos = options.includePhotos ? await loadMemoryPhotos(memory.id, memory.photos || []) : [];
      return buildMemorySharePayload({
        state,
        memoryId,
        photos,
        options,
        appVersion: APP_VERSION
      });
    }

    async function buildPlacesShare(placeIds: string[], options: PlaceShareOptions): Promise<LifeLogSharePayload> {
      return buildPlacesSharePayload({
        state,
        placeIds,
        options,
        appVersion: APP_VERSION
      });
    }

    async function exportMemoryShare(memoryId: string, options: MemoryShareOptions): Promise<BackupExportResult> {
      const payload = await buildMemoryShare(memoryId, options);
      return saveBackupFile(buildShareFileName(payload), JSON.stringify(payload, null, 2));
    }

    async function exportPlacesShare(placeIds: string[], options: PlaceShareOptions): Promise<BackupExportResult> {
      const payload = await buildPlacesShare(placeIds, options);
      return saveBackupFile(buildShareFileName(payload), JSON.stringify(payload, null, 2));
    }

    async function importShareData(payload: LifeLogSharePayload): Promise<LifeLogShareImportResult> {
      const plan = await buildShareImportPlan(payload, state);
      if (plan.people.length) await Promise.all(plan.people.map(savePersonRecord));
      if (plan.places.length) await savePlaceRecords(plan.places);
      if (plan.memories.length) await Promise.all(plan.memories.map(saveMemoryRecord));
      if (plan.photos.length) await savePhotoRecords(plan.photos);

      setState((current) => ({
        ...current,
        people: mergeById(current.people, plan.people),
        places: mergeById(current.places, plan.places),
        memories: mergeById(current.memories, plan.memories)
      }));

      return plan.result;
    }

    async function undoShareImport(result: LifeLogShareImportResult) {
      const memoryIds = result.createdMemoryIds || [];
      const personIds = result.createdPersonIds || [];
      const placeIds = result.createdPlaceIds || [];
      const photoIds = result.createdPhotoIds || [];

      if (memoryIds.length) await Promise.all(memoryIds.map(deleteMemoryRecord));
      if (photoIds.length) await deletePhotoRecords(photoIds);
      if (personIds.length) await Promise.all(personIds.map(deletePersonRecord));
      if (placeIds.length) await Promise.all(placeIds.map(deletePlaceRecord));

      setState((current) => ({
        ...current,
        people: current.people.filter((person) => !personIds.includes(person.id)),
        places: current.places.filter((place) => !placeIds.includes(place.id)),
        memories: current.memories.filter((memory) => !memoryIds.includes(memory.id))
      }));
    }

    async function resetDemo() {
      await resetDatabase();
      await clearPlaceMergeHistory();
      const next = await loadLifeLogState();
      setState(next);
      setPlaceMergeHistory([]);
    }

    const latestPlaceMerge = placeMergeHistory[0] || null;

    async function loadMemoryPhotos(memoryId: string, photoIds: string[] = []): Promise<Photo[]> {
      const photos = await loadPhotosByMemoryId(memoryId);
      return photos.length ? photos : loadPhotosByIds(photoIds);
    }

    return {
      state,
      settings,
      reminderSettings,
      notionSettings,
      notionPageMappings,
      isLoading,
      savePerson,
      updatePersonProfile,
      togglePersonFavorite,
      saveAnniversaryPlan,
      deleteAnniversaryPlan,
      inspectPlaceSave,
      savePlace,
      updatePlacesBulk,
      restorePlacesBulk,
      togglePlaceFavorite,
      saveMemory,
      deleteEntry,
      restoreDeletedEntry,
      getDeleteSnapshot,
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
      updateNotionSettings,
      syncNotionAll,
      exportData,
      buildMemoryShare,
      buildPlacesShare,
      exportMemoryShare,
      exportPlacesShare,
      importShareData,
      undoShareImport,
      resetDemo,
      loadMemoryPhotos
    };
  }, [duplicatePlaceGroups, isLoading, notionPageMappings, notionSettings, placeMergeHistory, settings, reminderSettings, state]);

  return <LifeLogContext.Provider value={value}>{children}</LifeLogContext.Provider>;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (!incoming.length) return current;
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => incomingById.get(item.id) || item);
  const missing = incoming.filter((item) => !current.some((currentItem) => currentItem.id === item.id));
  return [...merged, ...missing];
}

function restoreMemoryList(current: MemoryEvent[], snapshots: MemoryEvent[]) {
  if (!snapshots.length) return current;
  const snapshotIds = new Set(snapshots.map((memory) => memory.id));
  const snapshotById = new Map(snapshots.map((memory) => [memory.id, memory]));
  const restored = current.map((memory) => snapshotById.get(memory.id) || memory);
  const missing = snapshots.filter((memory) => !current.some((item) => item.id === memory.id));
  return [...restored.filter((memory) => !snapshotIds.has(memory.id) || snapshotById.has(memory.id)), ...missing];
}

function restorePlanList(current: AnniversaryPlan[], snapshots: AnniversaryPlan[]) {
  if (!snapshots.length) return current;
  const snapshotById = new Map(snapshots.map((plan) => [plan.id, plan]));
  const restored = current.map((plan) => snapshotById.get(plan.id) || plan);
  const missing = snapshots.filter((plan) => !current.some((item) => item.id === plan.id));
  return [...restored, ...missing];
}

export function useLifeLog() {
  const context = useContext(LifeLogContext);
  if (!context) {
    throw new Error("useLifeLog must be used inside LifeLogProvider");
  }
  return context;
}
