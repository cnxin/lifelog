import { APP_VERSION } from "../constants/version";

export type UxMetricEvent = "record_flow" | "photo_process" | "search_flow" | "home_section" | "onboarding_step" | "smart_prompt";
export type HomeMetricSection = "todayQueue" | "taskQueue" | "homeLibrary";
export type OnboardingMetricStep = "first-memory" | "first-person" | "backup-choice";
export type SmartPromptMetricCategory = "anniversary" | "contact" | "profile" | "place" | "record-gap";

export type UxMetricSample =
  | { event: "record_flow"; mode: "quick" | "full"; outcome: "saved" | "cancelled"; durationMs: number }
  | { event: "photo_process"; format: "heic" | "other"; outcome: "success" | "retry" | "fail"; durationMs: number }
  | { event: "search_flow"; resultCount: "0" | "1-5" | "6-20" | "21+"; outcome: "selected" | "abandoned"; durationMs: number }
  | { event: "home_section"; section: HomeMetricSection; action: "open" | "close" }
  | { event: "onboarding_step"; step: OnboardingMetricStep; outcome: "complete" | "skip" }
  | { event: "smart_prompt"; category: SmartPromptMetricCategory; outcome: "shown" | "open" | "snooze" | "dismiss" | "reduce" };

export interface UxMetricAggregate {
  event: UxMetricEvent;
  dimensions: Record<string, string>;
  count: number;
  durationTotalMs: number;
  durationBuckets: Record<UxDurationBucket, number>;
}

export interface UxMetricDay {
  date: string;
  appVersion: string;
  aggregates: UxMetricAggregate[];
}

export interface UxMetricsSnapshot {
  version: 1;
  days: UxMetricDay[];
}

export interface UxMetricsSummary {
  dayCount: number;
  totalSamples: number;
  eventCounts: Record<UxMetricEvent, number>;
}

type UxDurationBucket = "under-1s" | "1-5s" | "5-15s" | "15-60s" | "60s-plus";

interface StoredUxMetricDay {
  date: string;
  appVersion: string;
  aggregates: Record<string, UxMetricAggregate>;
}

interface StoredUxMetrics {
  version: 1;
  days: Record<string, StoredUxMetricDay>;
}

interface NormalizedUxMetricSample {
  event: UxMetricEvent;
  dimensions: Record<string, string>;
  durationMs?: number;
}

const STORAGE_KEY = "lifelog:ux-metrics:v1";
const MAX_DAY_BUCKETS = 90;
const EMPTY_DURATION_BUCKETS: Record<UxDurationBucket, number> = {
  "under-1s": 0,
  "1-5s": 0,
  "5-15s": 0,
  "15-60s": 0,
  "60s-plus": 0
};
const EVENT_NAMES: UxMetricEvent[] = ["record_flow", "photo_process", "search_flow", "home_section", "onboarding_step", "smart_prompt"];

export function recordUxMetric(sample: UxMetricSample, now = new Date()): boolean {
  if (!validateUxMetricSample(sample)) return false;
  const storage = getStorage();
  if (!storage) return false;

  try {
    const store = loadStoredMetrics(storage);
    const date = toDateKey(now);
    const normalized = normalizeSample(sample);
    const aggregateKey = buildAggregateKey(normalized.event, normalized.dimensions);
    const day = store.days[date] || { date, appVersion: APP_VERSION, aggregates: {} };
    const current = day.aggregates[aggregateKey] || {
      event: normalized.event,
      dimensions: normalized.dimensions,
      count: 0,
      durationTotalMs: 0,
      durationBuckets: { ...EMPTY_DURATION_BUCKETS }
    };

    current.count += 1;
    if (normalized.durationMs !== undefined) {
      current.durationTotalMs += normalized.durationMs;
      current.durationBuckets[getDurationBucket(normalized.durationMs)] += 1;
    }
    day.aggregates[aggregateKey] = current;
    store.days[date] = day;
    trimOldDays(store);
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event("lifelog:ux-metrics-changed"));
    return true;
  } catch {
    return false;
  }
}

export function validateUxMetricSample(value: unknown): value is UxMetricSample {
  if (!isRecord(value) || typeof value.event !== "string") return false;
  switch (value.event) {
    case "record_flow":
      return hasOnlyKeys(value, ["event", "mode", "outcome", "durationMs"])
        && isOneOf(value.mode, ["quick", "full"])
        && isOneOf(value.outcome, ["saved", "cancelled"])
        && isDuration(value.durationMs);
    case "photo_process":
      return hasOnlyKeys(value, ["event", "format", "outcome", "durationMs"])
        && isOneOf(value.format, ["heic", "other"])
        && isOneOf(value.outcome, ["success", "retry", "fail"])
        && isDuration(value.durationMs);
    case "search_flow":
      return hasOnlyKeys(value, ["event", "resultCount", "outcome", "durationMs"])
        && isOneOf(value.resultCount, ["0", "1-5", "6-20", "21+"])
        && isOneOf(value.outcome, ["selected", "abandoned"])
        && isDuration(value.durationMs);
    case "home_section":
      return hasOnlyKeys(value, ["event", "section", "action"])
        && isOneOf(value.section, ["todayQueue", "taskQueue", "homeLibrary"])
        && isOneOf(value.action, ["open", "close"]);
    case "onboarding_step":
      return hasOnlyKeys(value, ["event", "step", "outcome"])
        && isOneOf(value.step, ["first-memory", "first-person", "backup-choice"])
        && isOneOf(value.outcome, ["complete", "skip"]);
    case "smart_prompt":
      return hasOnlyKeys(value, ["event", "category", "outcome"])
        && isOneOf(value.category, ["anniversary", "contact", "profile", "place", "record-gap"])
        && isOneOf(value.outcome, ["shown", "open", "snooze", "dismiss", "reduce"]);
    default:
      return false;
  }
}

export function getUxMetricsSnapshot(): UxMetricsSnapshot {
  const storage = getStorage();
  const store = storage ? loadStoredMetrics(storage) : createEmptyStore();
  return {
    version: 1,
    days: Object.values(store.days)
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((day) => ({
        date: day.date,
        appVersion: day.appVersion,
        aggregates: Object.values(day.aggregates).sort((left, right) => buildAggregateKey(left.event, left.dimensions).localeCompare(buildAggregateKey(right.event, right.dimensions)))
      }))
  };
}

export function getUxMetricsSummary(): UxMetricsSummary {
  const snapshot = getUxMetricsSnapshot();
  const eventCounts = Object.fromEntries(EVENT_NAMES.map((event) => [event, 0])) as Record<UxMetricEvent, number>;
  for (const day of snapshot.days) {
    for (const aggregate of day.aggregates) eventCounts[aggregate.event] += aggregate.count;
  }
  return {
    dayCount: snapshot.days.length,
    totalSamples: Object.values(eventCounts).reduce((total, count) => total + count, 0),
    eventCounts
  };
}

export function exportUxMetricsJson() {
  return JSON.stringify(getUxMetricsSnapshot(), null, 2);
}

export function clearUxMetrics() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("lifelog:ux-metrics-changed"));
  } catch {
    // UX metrics are optional and must never block the app.
  }
}

export function getSearchResultCountBucket(count: number): "0" | "1-5" | "6-20" | "21+" {
  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 20) return "6-20";
  return "21+";
}

function normalizeSample(sample: UxMetricSample): NormalizedUxMetricSample {
  switch (sample.event) {
    case "record_flow":
      return { event: sample.event, dimensions: { mode: sample.mode, outcome: sample.outcome }, durationMs: normalizeDuration(sample.durationMs) };
    case "photo_process":
      return { event: sample.event, dimensions: { format: sample.format, outcome: sample.outcome }, durationMs: normalizeDuration(sample.durationMs) };
    case "search_flow":
      return { event: sample.event, dimensions: { resultCount: sample.resultCount, outcome: sample.outcome }, durationMs: normalizeDuration(sample.durationMs) };
    case "home_section":
      return { event: sample.event, dimensions: { section: sample.section, action: sample.action } };
    case "onboarding_step":
      return { event: sample.event, dimensions: { step: sample.step, outcome: sample.outcome } };
    case "smart_prompt":
      return { event: sample.event, dimensions: { category: sample.category, outcome: sample.outcome } };
  }
}

function loadStoredMetrics(storage: Storage): StoredUxMetrics {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredMetrics(parsed)) return createEmptyStore();
    return parsed;
  } catch {
    return createEmptyStore();
  }
}

function isStoredMetrics(value: unknown): value is StoredUxMetrics {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.days)) return false;
  return Object.entries(value.days).every(([date, day]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(day) || day.date !== date || typeof day.appVersion !== "string" || !isRecord(day.aggregates)) return false;
    return Object.values(day.aggregates).every(isStoredAggregate);
  });
}

function isStoredAggregate(value: unknown): value is UxMetricAggregate {
  if (!isRecord(value) || !isOneOf(value.event, EVENT_NAMES) || !isRecord(value.dimensions) || typeof value.count !== "number" || typeof value.durationTotalMs !== "number" || !isRecord(value.durationBuckets)) return false;
  const dimensions = value.dimensions;
  const durationBuckets = value.durationBuckets;
  return Object.keys(dimensions).every((key) => typeof dimensions[key] === "string")
    && Object.keys(EMPTY_DURATION_BUCKETS).every((key) => typeof durationBuckets[key] === "number");
}

function createEmptyStore(): StoredUxMetrics {
  return { version: 1, days: {} };
}

function trimOldDays(store: StoredUxMetrics) {
  const dates = Object.keys(store.days).sort();
  for (const date of dates.slice(0, Math.max(0, dates.length - MAX_DAY_BUCKETS))) delete store.days[date];
}

function buildAggregateKey(event: UxMetricEvent, dimensions: Record<string, string>) {
  return [event, ...Object.entries(dimensions).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`)].join("|");
}

function getDurationBucket(durationMs: number): UxDurationBucket {
  if (durationMs < 1000) return "under-1s";
  if (durationMs < 5000) return "1-5s";
  if (durationMs < 15000) return "5-15s";
  if (durationMs < 60000) return "15-60s";
  return "60s-plus";
}

function normalizeDuration(value: number) {
  return Math.min(24 * 60 * 60 * 1000, Math.max(0, Math.round(value)));
}

function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key)) && allowed.every((key) => key in value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
