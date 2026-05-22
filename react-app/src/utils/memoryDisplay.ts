import type { MemoryDisplayContext, MemoryEvent } from "../types";
import { getMemoryPlaceIds } from "./memoryPlaces";

const SENTENCE_SPLIT = /[。！？!?\n]/;
const SUMMARY_MAX = 24;
const UNLINKED_PERSON_LABEL = "未关联人物";
const UNLINKED_PLACE_LABEL = "未关联地点";

export function getMemoryDisplayTitle(memory: MemoryEvent, ctx: MemoryDisplayContext): string {
  const manual = memory.title?.trim();
  if (manual && manual !== "新的回忆") return manual;
  return deriveMemorySummary(memory, ctx);
}

export function deriveMemorySummary(memory: MemoryEvent, ctx: MemoryDisplayContext): string {
  const firstPerson = ctx.personNames.find((name) => name?.trim());
  const place = ctx.placeName?.trim();
  const sentence = firstSentence(memory.content);

  if (firstPerson && place) return `和${firstPerson}在${place}`;
  if (firstPerson && sentence) return `${firstPerson} · ${sentence}`;
  if (place && sentence) return `${place} · ${sentence}`;
  if (sentence) return sentence;
  if (firstPerson) return `关于${firstPerson}的回忆`;
  if (place) return `在${place}`;
  return "未命名回忆";
}

export function firstSentence(content: string): string {
  const normalized = (content || "").trim();
  if (!normalized) return "";
  const head = normalized.split(SENTENCE_SPLIT)[0]?.trim() || normalized;
  return head.length > SUMMARY_MAX ? `${head.slice(0, SUMMARY_MAX)}…` : head;
}

export function isManualTitle(memory: MemoryEvent): boolean {
  const t = memory.title?.trim();
  return Boolean(t && t !== "新的回忆");
}

export function buildMemoryDisplayContext(
  memory: MemoryEvent,
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
): MemoryDisplayContext {
  const personNames = (memory.personIds || [])
    .filter(Boolean)
    .map(getPersonName)
    .filter((name) => Boolean(name) && name !== UNLINKED_PERSON_LABEL);
  const placeNames = getMemoryPlaceIds(memory)
    .map(getPlaceName)
    .filter((name) => Boolean(name) && name !== UNLINKED_PLACE_LABEL);
  const placeName = placeNames.join("、");

  return {
    personNames,
    placeName: placeName && placeName !== UNLINKED_PLACE_LABEL ? placeName : "",
    placeNames
  };
}
