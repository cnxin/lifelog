export type SearchKind = "memory" | "person" | "place";
export type SearchField = "标题" | "正文" | "标签" | "人物" | "地点" | "喜好" | "纪念日" | "地址" | "平台" | "备注" | "分类";

export interface SearchKeyword {
  field: SearchField;
  value: string;
}

export interface SearchResult {
  id: string;
  kind: SearchKind;
  kindLabel?: string;
  title: string;
  subtitle: string;
  meta: string;
  path: string;
  searchText: string;
  keywords: SearchKeyword[];
  scoreBase: number;
  date?: string;
  personIds?: string[];
  personNames?: string[];
}

export interface ParsedSearchQuery {
  raw: string;
  tokens: string[];
  mentionNames: string[];
  exactDates: string[];
  yearMonths: string[];
  hasSemanticFilter: boolean;
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const source = raw.trim();
  if (!source) {
    return { raw: "", tokens: [], mentionNames: [], exactDates: [], yearMonths: [], hasSemanticFilter: false };
  }

  const mentionNames: string[] = [];
  const mentionRegex = /@([一-鿿A-Za-z0-9_·]{1,24})/g;
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = mentionRegex.exec(source))) {
    const name = mentionMatch[1].trim();
    if (name) mentionNames.push(name);
  }

  const exactDates = Array.from(new Set(source.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []));
  const yearMonths = Array.from(
    new Set((source.match(/\b\d{4}-\d{2}\b/g) || []).filter((item) => !exactDates.some((date) => date.startsWith(item))))
  );

  let residual = source;
  for (const name of mentionNames) residual = residual.replace(new RegExp(`@${escapeRegExp(name)}`, "g"), " ");
  for (const date of exactDates) residual = residual.replace(date, " ");
  for (const month of yearMonths) residual = residual.replace(month, " ");
  residual = residual.replace(/@/g, " ");

  const tokens = normalizeSearchText(residual).split(" ").filter(Boolean);
  return {
    raw: source,
    tokens,
    mentionNames: uniquePreserve(mentionNames),
    exactDates,
    yearMonths,
    hasSemanticFilter: Boolean(mentionNames.length || exactDates.length || yearMonths.length)
  };
}

export function rankSearchResults(index: SearchResult[], query: ParsedSearchQuery, limit = 36) {
  if (!query.tokens.length && !query.hasSemanticFilter) return [];
  return index
    .map((item) => ({ item, score: scoreSearchResult(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      const kindRank = kindPriority(left.item.kind, query) - kindPriority(right.item.kind, query);
      return kindRank
        || right.score - left.score
        || right.item.scoreBase - left.item.scoreBase
        || left.item.title.localeCompare(right.item.title, "zh-CN");
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function scoreSearchResult(result: SearchResult, query: ParsedSearchQuery) {
  if (query.mentionNames.length) {
    const ok = query.mentionNames.some((name) => matchesMention(result, name));
    if (!ok) return 0;
  }

  if (query.exactDates.length) {
    if (result.kind !== "memory" || !result.date || !query.exactDates.includes(result.date)) return 0;
  } else if (query.yearMonths.length) {
    if (result.kind !== "memory" || !result.date || !query.yearMonths.some((month) => result.date!.startsWith(month))) return 0;
  }

  const tokens = query.tokens;
  if (!tokens.length) {
    let score = result.scoreBase + 20;
    if (query.mentionNames.length && result.kind === "person") score += 40;
    if (query.mentionNames.length && result.kind === "memory") score += 24;
    if (query.exactDates.length || query.yearMonths.length) score += 30;
    return score;
  }

  let score = 0;
  const title = normalizeSearchText(result.title);
  const subtitle = normalizeSearchText(result.subtitle);
  for (const token of tokens) {
    if (!result.searchText.includes(token)) return 0;
    if (title === token) score += 42;
    else if (title.startsWith(token)) score += 32;
    else if (title.includes(token)) score += 24;
    else if (subtitle.includes(token)) score += 12;
    else score += 6;
  }

  if (query.mentionNames.length && result.kind === "person") score += 36;
  if (query.mentionNames.length && result.kind === "memory") score += 18;
  if (query.exactDates.length && result.kind === "memory") score += 28;
  if (query.yearMonths.length && result.kind === "memory") score += 20;
  return score + result.scoreBase;
}

export function buildMatchHint(result: SearchResult, query: ParsedSearchQuery) {
  if (query.mentionNames.length && result.kind === "person") return `人物命中：@${query.mentionNames[0]}`;
  if (query.mentionNames.length && result.kind === "memory") return `与 @${query.mentionNames[0]} 相关`;
  if (query.exactDates.length && result.date) return `日期命中：${result.date}`;
  if (query.yearMonths.length && result.date) return `月份命中：${result.date.slice(0, 7)}`;

  const exactFields = new Set<SearchField>();
  const matchedKeywords: SearchKeyword[] = [];
  for (const keywordItem of result.keywords) {
    const normalized = normalizeSearchText(keywordItem.value);
    if (!normalized) continue;
    if (query.tokens.some((token) => normalized.includes(token))) {
      exactFields.add(keywordItem.field);
      matchedKeywords.push(keywordItem);
    }
  }

  const first = matchedKeywords.find((item) => item.field !== "标题") || matchedKeywords[0];
  if (!first) return kindLabel(result.kind);
  return `命中${Array.from(exactFields).slice(0, 2).join("、")}：${compactMatchText(first.value, query.tokens)}`;
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:()[\]{}"'“”‘’/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function kindLabel(kind: SearchKind) {
  if (kind === "person") return "人物";
  if (kind === "place") return "地点";
  return "记录";
}

export function keyword(field: SearchField, value?: string | null): SearchKeyword | null {
  const text = String(value || "").trim();
  return text ? { field, value: text } : null;
}

export function isSearchKeyword(value: SearchKeyword | null): value is SearchKeyword {
  return Boolean(value);
}

function matchesMention(result: SearchResult, mention: string) {
  const target = normalizeSearchText(mention);
  if (!target) return false;
  const names = (result.personNames || []).map((name) => normalizeSearchText(name)).filter(Boolean);
  if (result.kind === "person" || result.kind === "memory") {
    return names.some((name) => name === target || name.includes(target) || target.includes(name));
  }
  return false;
}

function kindPriority(kind: SearchKind, query: ParsedSearchQuery) {
  if (query.mentionNames.length) {
    if (kind === "person") return 0;
    if (kind === "memory") return 1;
    return 2;
  }
  if (query.exactDates.length || query.yearMonths.length) {
    if (kind === "memory") return 0;
    if (kind === "person") return 1;
    return 2;
  }
  if (kind === "memory") return 0;
  if (kind === "person") return 1;
  return 2;
}

function compactMatchText(value: string, tokens: string[]) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 28) return text;
  const normalized = normalizeSearchText(text);
  const token = tokens.find((item) => normalized.includes(item));
  if (!token) return `${text.slice(0, 26)}...`;
  const start = Math.max(0, normalized.indexOf(token) - 8);
  const end = Math.min(text.length, start + 28);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function uniquePreserve(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = normalizeSearchText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
