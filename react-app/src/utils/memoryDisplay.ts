import type { MemoryDisplayContext, MemoryEvent } from "../types";
import { getMemoryPlaceIds } from "./memoryPlaces";

const SENTENCE_SPLIT = /[。！？!?\n]/;
const SUMMARY_MAX = 24;
const UNLINKED_PERSON_LABEL = "未关联人物";
const UNLINKED_PLACE_LABEL = "未关联地点";

export function isMemoryPlan(memory: Pick<MemoryEvent, "kind">): boolean {
  return memory.kind === "plan";
}

export function isSkippedMemoryPlan(memory: Pick<MemoryEvent, "kind" | "tags">): boolean {
  return isMemoryPlan(memory) && (memory.tags || []).some((tag) => isPlanSkipTag(tag));
}

export function isActiveMemoryPlan(memory: Pick<MemoryEvent, "kind" | "tags">): boolean {
  return isMemoryPlan(memory) && !isSkippedMemoryPlan(memory);
}

export function getMemoryKindLabel(memory: Pick<MemoryEvent, "kind">): string {
  return isMemoryPlan(memory) ? "计划" : "回忆";
}

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
  if (firstPerson) return isMemoryPlan(memory) ? `和${firstPerson}的计划` : `关于${firstPerson}的回忆`;
  if (place) return `在${place}`;
  return isMemoryPlan(memory) ? "未命名计划" : "未命名回忆";
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

export function compactPlaceNames(placeNames: string[], visibleCount = 2): string {
  const names = placeNames.map((name) => name.trim()).filter(Boolean);
  if (names.length <= visibleCount) return names.join("、");
  return `${names.slice(0, visibleCount).join("、")} 等 ${names.length} 个地点`;
}

export function buildMemoryMetaLine(ctx: MemoryDisplayContext) {
  return [ctx.personNames.join("、"), compactPlaceNames(ctx.placeNames)]
    .filter(Boolean)
    .join(" · ");
}

function isPlanSkipTag(tag: string) {
  return ["计划取消", "没发生"].includes(tag.trim());
}
