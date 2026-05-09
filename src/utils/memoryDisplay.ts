import type { MemoryDisplayContext, MemoryEvent } from "../types";

const SENTENCE_SPLIT = /[。！？!?\n]/;
const SUMMARY_MAX = 24;

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
  return {
    personNames: (memory.personIds || []).map(getPersonName).filter(Boolean),
    placeName: getPlaceName(memory.placeId) || ""
  };
}
