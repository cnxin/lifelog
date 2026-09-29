import { usePersistentState } from "./usePersistentState";
import type { SmartPromptMetricCategory } from "../utils/uxMetrics";

export type SmartPromptCategoryPreferences = Partial<Record<SmartPromptMetricCategory, boolean>>;

export interface UserPreferences {
  homeTodayQueueExpanded?: boolean;
  homeTaskQueueExpanded?: boolean;
  homeLibraryExpanded?: boolean;
  smartPromptCategories?: SmartPromptCategoryPreferences;
  listViewMode: "compact" | "detailed";
  defaultMemoryMode: "quick" | "full";
  placeCardExpanded: boolean;
}

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  listViewMode: "compact",
  defaultMemoryMode: "quick",
  placeCardExpanded: false
};

export function useUserPreferences() {
  const [prefs, setPrefs] = usePersistentState<UserPreferences>(
    "lifelog:user-preferences",
    DEFAULT_USER_PREFERENCES,
    isUserPreferences
  );

  function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs({ ...prefs, [key]: value });
  }

  return { prefs, updatePreference };
}

export function getBooleanPreference(
  prefs: UserPreferences,
  key: keyof Pick<UserPreferences, "homeTodayQueueExpanded" | "homeTaskQueueExpanded" | "homeLibraryExpanded">,
  fallback: boolean
) {
  return typeof prefs[key] === "boolean" ? prefs[key] : fallback;
}

export function isSmartPromptCategoryEnabled(prefs: UserPreferences, category: SmartPromptMetricCategory) {
  return prefs.smartPromptCategories?.[category] !== false;
}

function isUserPreferences(value: unknown): value is UserPreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UserPreferences>;
  return (
    (candidate.homeTodayQueueExpanded === undefined || typeof candidate.homeTodayQueueExpanded === "boolean") &&
    (candidate.homeTaskQueueExpanded === undefined || typeof candidate.homeTaskQueueExpanded === "boolean") &&
    (candidate.homeLibraryExpanded === undefined || typeof candidate.homeLibraryExpanded === "boolean") &&
    (candidate.smartPromptCategories === undefined || isSmartPromptCategoryPreferences(candidate.smartPromptCategories)) &&
    (candidate.listViewMode === undefined || candidate.listViewMode === "compact" || candidate.listViewMode === "detailed") &&
    (candidate.defaultMemoryMode === undefined || candidate.defaultMemoryMode === "quick" || candidate.defaultMemoryMode === "full") &&
    (candidate.placeCardExpanded === undefined || typeof candidate.placeCardExpanded === "boolean")
  );
}

function isSmartPromptCategoryPreferences(value: unknown): value is SmartPromptCategoryPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const allowed = ["anniversary", "contact", "profile", "place", "record-gap"];
  return Object.entries(value).every(([key, enabled]) => allowed.includes(key) && typeof enabled === "boolean");
}
