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
  const inferenceText = [rawTitle, content].map((item) => item.trim()).filter(Boolean).join("\n");

  return {
    title: buildMemoryTitle(rawTitle, content),
    date: inferMemoryDate(inferenceText, fallbackDate),
    personIds: manualPersonIds.length ? manualPersonIds : inferPersonIds(inferenceText, people, fallbackPersonId),
    placeId: selectedPlaceId || inferPlaceId(inferenceText, places)
  };
}

export function buildMemoryTitle(rawTitle: string, content: string) {
  const title = rawTitle.trim();
  if (title && title !== "快速记录" && title !== "新的回忆") return title;
  return content.trim() ? "" : title;
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
  const directMatch = pickUniquePlaceMatch(normalized, places, (place) => [place.name, place.storeName], 2);
  if (directMatch) return directMatch;

  return pickUniquePlaceMatch(normalized, places, (place) => [place.mall, place.area], 3);
}

export function inferMemoryDate(content: string, fallbackDate: string) {
  const normalized = content.trim();
  const baseDate = parseDateValue(fallbackDate) || new Date();
  baseDate.setHours(0, 0, 0, 0);

  if (normalized.includes("前天")) return formatDateValue(addDays(baseDate, -2));
  if (normalized.includes("昨天") || normalized.includes("昨晚")) return formatDateValue(addDays(baseDate, -1));
  if (normalized.includes("今天") || normalized.includes("今晚")) return formatDateValue(baseDate);
  if (normalized.includes("明天")) return formatDateValue(addDays(baseDate, 1));
  if (normalized.includes("后天")) return formatDateValue(addDays(baseDate, 2));

  const fullDateMatch = normalized.match(/(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})日?/);
  if (fullDateMatch) return normalizeDateParts(fullDateMatch[1], fullDateMatch[2], fullDateMatch[3], fallbackDate);

  const monthDayMatch = normalized.match(/(\d{1,2})[月./-](\d{1,2})日?/);
  if (monthDayMatch) return normalizeDateParts(String(baseDate.getFullYear()), monthDayMatch[1], monthDayMatch[2], fallbackDate);

  return fallbackDate;
}

function pickUniquePlaceMatch(
  content: string,
  places: PlaceLookup[],
  getAliases: (place: PlaceLookup) => Array<string | undefined>,
  minLength: number
) {
  const matches = places
    .map((place) => {
      const aliases = getAliases(place)
        .map((item) => String(item || "").trim())
        .filter((item) => item.length >= minLength && content.includes(item));
      if (!aliases.length) return null;
      return {
        id: place.id,
        score: Math.max(...aliases.map((item) => item.length))
      };
    })
    .filter((item): item is { id: string; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score);

  if (!matches.length) return "";
  if (matches.length === 1) return matches[0].id;
  return matches[0].score > matches[1].score ? matches[0].id : "";
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

function parseDateValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (formatDateValue(date) !== value) return null;
  return date;
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
