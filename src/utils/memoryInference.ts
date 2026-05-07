import type { Person, Place } from "../types";

type PersonLookup = Pick<Person, "id" | "name"> & Partial<Pick<Person, "nickname">>;
type PlaceLookup = Pick<Place, "id" | "name"> & Partial<Pick<Place, "storeName" | "area" | "mall" | "address">>;

interface QuickMemoryInferenceInput {
  rawTitle?: string;
  content: string;
  people: PersonLookup[];
  places: PlaceLookup[];
  fallbackDate: string;
  selectedPersonIds?: string[];
  selectedPlaceId?: string;
  fallbackPersonId?: string;
}

export function inferQuickMemory({
  rawTitle = "",
  content,
  people,
  places,
  fallbackDate,
  selectedPersonIds = [],
  selectedPlaceId = "",
  fallbackPersonId = ""
}: QuickMemoryInferenceInput) {
  const manualPersonIds = selectedPersonIds.filter(Boolean);

  return {
    title: buildMemoryTitle(rawTitle, content),
    date: inferMemoryDate(content, fallbackDate),
    personIds: manualPersonIds.length ? manualPersonIds : inferPersonIds(content, people, fallbackPersonId),
    placeId: selectedPlaceId || inferPlaceId(content, places)
  };
}

export function buildMemoryTitle(rawTitle: string, content: string) {
  const title = rawTitle.trim();
  if (title && title !== "快速记录") return title;

  const normalizedContent = content.trim().replace(/\s+/g, " ");
  if (!normalizedContent) return title || "新的回忆";

  return normalizedContent.length > 16 ? `${normalizedContent.slice(0, 16)}...` : normalizedContent;
}

export function inferPersonIds(content: string, people: PersonLookup[], fallbackId = "") {
  const normalized = content.trim();
  const matched = people
    .filter((person) => {
      const names = [person.name, person.nickname].filter(Boolean);
      return names.some((name) => normalized.includes(String(name)));
    })
    .map((person) => person.id);

  return matched.length ? matched : [fallbackId].filter(Boolean);
}

export function inferPlaceId(content: string, places: PlaceLookup[]) {
  const normalized = content.trim();
  return (
    places.find((place) => {
      const names = [place.name, place.storeName].filter(Boolean);
      return names.some((name) => String(name).length >= 3 && normalized.includes(String(name)));
    })?.id || ""
  );
}

export function inferMemoryDate(content: string, fallbackDate: string) {
  const normalized = content.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (normalized.includes("前天")) return formatDateValue(addDays(today, -2));
  if (normalized.includes("昨天") || normalized.includes("昨晚")) return formatDateValue(addDays(today, -1));
  if (normalized.includes("明天")) return formatDateValue(addDays(today, 1));

  const fullDateMatch = normalized.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/);
  if (fullDateMatch) return normalizeDateParts(fullDateMatch[1], fullDateMatch[2], fullDateMatch[3], fallbackDate);

  const monthDayMatch = normalized.match(/(\d{1,2})月(\d{1,2})日?/);
  if (monthDayMatch) return normalizeDateParts(String(today.getFullYear()), monthDayMatch[1], monthDayMatch[2], fallbackDate);

  return fallbackDate;
}

function normalizeDateParts(yearValue: string, monthValue: string, dayValue: string, fallbackDate: string) {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return fallbackDate;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return fallbackDate;
  return formatDateValue(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
