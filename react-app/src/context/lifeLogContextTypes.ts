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
import type { BackupExportTarget } from "../utils/backupExport";
import type { BackupExportOptions } from "../utils/lifelogBackup";
import type {
  LifeLogShareImportResult,
  LifeLogSharePayload,
  MemoryShareOptions,
  PlaceShareOptions
} from "../utils/lifelogShare";
import type { NotionSyncSummary, NotionSyncTarget } from "../utils/notionSync";

export type DeletedEntrySnapshot =
  | { type: "person"; person: Person; affectedMemories: MemoryEvent[]; affectedPlans: AnniversaryPlan[] }
  | { type: "place"; place: Place; affectedMemories: MemoryEvent[]; affectedPlans: AnniversaryPlan[] }
  | { type: "memory"; memory: MemoryEvent; photos: Photo[] };

export type BackupExportResult = BackupExportTarget;
export type BackupImportOptions = { safeMode?: boolean };
export type PersonBulkPatch = { favorite?: boolean };
export type PersonBulkSnapshot = Pick<Person, "id" | "favorite">;
export type MemoryBulkPatch = { appendTags?: string[] };
export type MemoryBulkSnapshot = Pick<MemoryEvent, "id" | "tags">;
export type PlaceBulkPatch = Partial<Pick<Place, "category" | "mall" | "area" | "favorite">> & { appendTags?: string[] };
export type PlaceBulkSnapshot = Pick<Place, "id" | "category" | "mall" | "area" | "tags" | "favorite">;

export interface LifeLogContextValue {
  state: LifeLogState;
  settings: AppSettings;
  reminderSettings: ReminderSettings;
  notionSettings: NotionSettings;
  notionPageMappings: NotionPageMapping[];
  notionSyncHistory: NotionSyncHistoryEntry[];
  notionSyncQueue: NotionSyncQueueItem[];
  isLoading: boolean;
  savePerson: (formData: FormData, id?: string) => Promise<string>;
  updatePersonProfile: (id: string, patch: Pick<Person, "preferences" | "dislikes">) => Promise<void>;
  updatePeopleBulk: (personIds: string[], patch: PersonBulkPatch) => Promise<{ count: number; before: PersonBulkSnapshot[] }>;
  restorePeopleBulk: (snapshots: PersonBulkSnapshot[]) => Promise<number>;
  togglePersonFavorite: (id: string) => Promise<void>;
  saveAnniversaryPlan: (plan: AnniversaryPlan) => Promise<string>;
  deleteAnniversaryPlan: (id: string) => Promise<void>;
  inspectPlaceSave: (formData: FormData, id?: string) => PlaceSaveInspection;
  savePlace: (formData: FormData, id?: string, options?: PlaceSaveOptions) => Promise<string>;
  updatePlacesBulk: (placeIds: string[], patch: PlaceBulkPatch) => Promise<{ count: number; before: PlaceBulkSnapshot[] }>;
  restorePlacesBulk: (snapshots: PlaceBulkSnapshot[]) => Promise<number>;
  togglePlaceFavorite: (id: string) => Promise<void>;
  saveMemory: (formData: FormData, id?: string, photos?: Photo[]) => Promise<string>;
  updateMemoriesBulk: (memoryIds: string[], patch: MemoryBulkPatch) => Promise<{ count: number; before: MemoryBulkSnapshot[] }>;
  restoreMemoriesBulk: (snapshots: MemoryBulkSnapshot[]) => Promise<number>;
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
  syncNotionAll: (settingsOverride?: NotionSettings) => Promise<NotionSyncSummary>;
  syncNotionTargets: (targets: NotionSyncTarget[], options?: { trigger?: NotionSyncTrigger; targetLabel?: string; settingsOverride?: NotionSettings; stateOverride?: LifeLogState }) => Promise<NotionSyncSummary>;
  retryFailedNotionItems: (items: NotionSyncFailedItem[], settingsOverride?: NotionSettings) => Promise<NotionSyncSummary>;
  retryNotionQueueItems: (ids?: string[]) => Promise<NotionSyncSummary | null>;
  exportData: (options?: BackupExportOptions) => Promise<BackupExportResult>;
  buildMemoryShare: (memoryId: string, options: MemoryShareOptions) => Promise<LifeLogSharePayload>;
  buildPlacesShare: (placeIds: string[], options: PlaceShareOptions) => Promise<LifeLogSharePayload>;
  exportMemoryShare: (memoryId: string, options: MemoryShareOptions) => Promise<BackupExportResult>;
  exportPlacesShare: (placeIds: string[], options: PlaceShareOptions) => Promise<BackupExportResult>;
  importShareData: (payload: LifeLogSharePayload) => Promise<LifeLogShareImportResult>;
  undoShareImport: (result: LifeLogShareImportResult) => Promise<void>;
  resetDemo: () => Promise<void>;
  loadMemoryPhotos: (memoryId: string, photoIds?: string[]) => Promise<Photo[]>;
}

