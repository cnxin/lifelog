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
  loadNotionSyncHistory,
  loadNotionSyncQueue,
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
  saveNotionSyncHistoryEntry,
  saveNotionSyncQueueItems,
  deleteNotionSyncQueueItems,
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
  NotionSyncFailedItem,
  NotionSyncHistoryEntry,
  NotionSyncQueueItem,
  NotionSyncTrigger,
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
  MAX_BACKUP_FILE_BYTES,
  type BackupExportOptions,
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
import { saveBackupFile } from "../utils/backupExport";
import { syncLifeLogToNotion, type NotionSyncTarget } from "../utils/notionSync";

import type { DeletedEntrySnapshot, BackupExportResult, BackupImportOptions, PersonBulkPatch, PersonBulkSnapshot, MemoryBulkPatch, MemoryBulkSnapshot, PlaceBulkPatch, PlaceBulkSnapshot, LifeLogContextValue } from "./lifeLogContextTypes";
import {
  buildNotionQueueItemId,
  buildNotionSyncHistoryEntry,
  canAutoSyncNotionTarget,
  formatNotionTargetLabel,
  mergeById,
  mergeNotionQueueItems,
  restoreMemoryList,
  restorePlanList,
  uniqueNotionTargets,
  upsertById
} from "./lifeLogContextHelpers";
import { createLifeLogContextValue } from "./createLifeLogContextValue";

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
  const [notionSyncHistory, setNotionSyncHistory] = useState<NotionSyncHistoryEntry[]>([]);
  const [notionSyncQueue, setNotionSyncQueue] = useState<NotionSyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [placeMergeHistory, setPlaceMergeHistory] = useState<PlaceMergeHistoryEntry[]>([]);
  const favoritePendingRef = useRef({ people: new Set<string>(), places: new Set<string>() });
  const notionQueueTimerRef = useRef<number | null>(null);
  const notionQueueRunningRef = useRef(false);
  const notionSyncQueueRef = useRef<NotionSyncQueueItem[]>([]);

  useEffect(() => {
    let active = true;
    const LOAD_TIMEOUT_MS = 8000;

    async function bootstrap() {
      try {
        const nextState = await withTimeout(loadLifeLogState(), LOAD_TIMEOUT_MS, "loadLifeLogState");
        const [
          nextSettings,
          nextReminderSettings,
          nextNotionSettings,
          nextNotionPageMappings,
          nextNotionSyncHistory,
          nextNotionSyncQueue,
          mergeHistory
        ] = await withTimeout(
          Promise.all([
            loadAppSettings(),
            loadReminderSettings(),
            loadNotionSettings(),
            loadNotionPageMappings(),
            loadNotionSyncHistory(),
            loadNotionSyncQueue(),
            loadPlaceMergeHistory()
          ]),
          LOAD_TIMEOUT_MS,
          "loadLocalSettings"
        );

        if (!active) return;
        setState(nextState);
        setSettings(nextSettings);
        setReminderSettings(nextReminderSettings);
        setNotionSettings(nextNotionSettings);
        setNotionPageMappings(nextNotionPageMappings);
        setNotionSyncHistory(nextNotionSyncHistory);
        notionSyncQueueRef.current = nextNotionSyncQueue;
        setNotionSyncQueue(nextNotionSyncQueue);
        setPlaceMergeHistory(mergeHistory);
      } catch (error) {
        console.error("LifeLog bootstrap failed", error);
        // Keep empty local defaults so the UI can still open offline / after DB glitches.
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    notionSyncQueueRef.current = notionSyncQueue;
  }, [notionSyncQueue]);

  useEffect(() => {
    return () => {
      if (notionQueueTimerRef.current) {
        window.clearTimeout(notionQueueTimerRef.current);
        notionQueueTimerRef.current = null;
      }
    };
  }, []);

  const duplicatePlaceGroups = useMemo(
    () => findPlaceDuplicateGroups(state.places),
    [state.places]
  );

  const value = useMemo<LifeLogContextValue>(
    () =>
      createLifeLogContextValue({
        state,
        settings,
        reminderSettings,
        notionSettings,
        notionPageMappings,
        notionSyncHistory,
        notionSyncQueue,
        isLoading,
        placeMergeHistory,
        duplicatePlaceGroups,
        setState,
        setSettings,
        setReminderSettings,
        setNotionSettings,
        setNotionPageMappings,
        setNotionSyncHistory,
        setNotionSyncQueue,
        setPlaceMergeHistory,
        favoritePendingRef,
        notionQueueTimerRef,
        notionQueueRunningRef,
        notionSyncQueueRef
      }),
    [duplicatePlaceGroups, isLoading, notionPageMappings, notionSettings, notionSyncHistory, notionSyncQueue, placeMergeHistory, settings, reminderSettings, state]
  );


  return <LifeLogContext.Provider value={value}>{children}</LifeLogContext.Provider>;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useLifeLog() {
  const context = useContext(LifeLogContext);
  if (!context) {
    throw new Error("useLifeLog must be used inside LifeLogProvider");
  }
  return context;
}
