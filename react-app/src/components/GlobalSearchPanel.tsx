import { Heart, MapPin, Search, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeLog } from "../context/LifeLogContext";
import { formatMonthDay } from "../utils/date";
import { buildMemoryDisplayContext, buildMemoryMetaLine, getMemoryDisplayTitle, getMemoryKindLabel, isMemoryPlan } from "../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../utils/memoryPlaces";
import { buildPlaceContextLine, buildPlaceDisplayName } from "../utils/placeMeta";

type SearchKind = "memory" | "person" | "place";
type SearchField = "标题" | "正文" | "标签" | "人物" | "地点" | "喜好" | "纪念日" | "地址" | "平台" | "备注" | "分类";

interface SearchKeyword {
  field: SearchField;
  value: string;
}

interface SearchResult {
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
}

export default function GlobalSearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setSelectedIndex(-1);
  }, [open]);

  const index = useMemo<SearchResult[]>(() => {
    const personById = new Map(state.people.map((person) => [person.id, person]));
    const placeById = new Map(state.places.map((place) => [place.id, place]));

    const peopleResults = state.people.map<SearchResult>((person) => {
      const preferenceKeywords = [...safeArray(person.preferences), ...safeArray(person.dislikes)]
        .flatMap((group) => [group.category, ...group.items])
        .filter(Boolean)
        .map((value) => ({ field: "喜好" as const, value }));
      const anniversaries = safeArray(person.anniversaries).map((item) => `${item.title} ${item.date}`).join(" ");
      const keywords = [
        keyword("标题", person.name),
        keyword("标题", person.nickname),
        keyword("分类", person.relationship),
        keyword("分类", person.favorite ? "收藏" : ""),
        ...preferenceKeywords,
        keyword("纪念日", anniversaries),
        keyword("备注", person.notes)
      ].filter(isSearchKeyword);
      return {
        id: person.id,
        kind: "person",
        title: person.name || "未命名人物",
        subtitle: [person.nickname, person.relationship].filter(Boolean).join(" · ") || "人物档案",
        meta: person.favorite ? "已收藏" : safeArray(person.anniversaries).length ? `${safeArray(person.anniversaries).length} 个纪念日` : "人物",
        path: `/people/${person.id}`,
        searchText: normalizeSearchText(keywords.map((item) => item.value).join(" ")),
        keywords,
        scoreBase: person.favorite ? 14 : 10
      };
    });

    const placeResults = state.places.map<SearchResult>((place) => {
      const title = buildPlaceDisplayName(place) || "未命名地点";
      const platformText = safeArray(place.platformLinks).map((link) => `${link.label} ${link.platform} ${link.url}`).join(" ");
      const keywords = [
        keyword("标题", title),
        keyword("标题", place.name),
        keyword("标题", place.storeName),
        keyword("分类", place.category),
        keyword("地址", [place.country, place.province, place.city, place.area, place.mall, place.address].filter(Boolean).join(" ")),
        keyword("备注", place.desc),
        keyword("平台", [place.mapUrl, place.sourceUrl, platformText].filter(Boolean).join(" ")),
        ...safeArray(place.tags).map((tag) => keyword("标签", tag)).filter(isSearchKeyword),
        keyword("分类", place.favorite ? "收藏" : "")
      ].filter(isSearchKeyword);
      return {
        id: place.id,
        kind: "place",
        title,
        subtitle: buildPlaceContextLine(place),
        meta: [place.category, place.rating ? `${place.rating} 分` : "", place.favorite ? "已收藏" : ""].filter(Boolean).join(" · ") || "地点",
        path: `/places/${place.id}`,
        searchText: normalizeSearchText(keywords.map((item) => item.value).join(" ")),
        keywords,
        scoreBase: place.favorite ? 13 : 9
      };
    });

    const memoryResults = state.memories.map<SearchResult>((memory) => {
      const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
      const title = getMemoryDisplayTitle(memory, ctx);
      const memoryKindLabel = getMemoryKindLabel(memory);
      const people = (memory.personIds || []).map((id) => personById.get(id)).filter(Boolean);
      const places = getMemoryPlaceIds(memory).map((id) => placeById.get(id)).filter(Boolean);
      const keywords = [
        keyword("标题", title),
        keyword("标题", memory.title),
        keyword("正文", memory.content),
        keyword("分类", memoryKindLabel),
        keyword("分类", memory.mood),
        keyword("分类", memory.date),
        ...ctx.personNames.map((name) => keyword("人物", name)).filter(isSearchKeyword),
        ...ctx.placeNames.map((name) => keyword("地点", name)).filter(isSearchKeyword),
        ...people.flatMap((person) => [
          keyword("人物", person?.nickname),
          keyword("人物", person?.relationship),
          keyword("备注", person?.notes)
        ]).filter(isSearchKeyword),
        ...places.flatMap((place) => [
          keyword("地点", place?.category),
          keyword("地址", [place?.city, place?.area, place?.mall, place?.address].filter(Boolean).join(" "))
        ]).filter(isSearchKeyword),
        ...(memory.tags || []).map((tag) => keyword("标签", tag)).filter(isSearchKeyword)
      ].filter(isSearchKeyword);
      return {
        id: memory.id,
        kind: "memory",
        kindLabel: memoryKindLabel,
        title,
        subtitle: buildMemoryMetaLine(ctx) || firstLine(memory.content) || (isMemoryPlan(memory) ? "计划记录" : "回忆记录"),
        meta: [formatMonthDay(memory.date), memory.mood, safeArray(memory.photos).length ? `${safeArray(memory.photos).length} 张照片` : ""].filter(Boolean).join(" · "),
        path: `/memories/${memory.id}`,
        searchText: normalizeSearchText(keywords.map((item) => item.value).join(" ")),
        keywords,
        scoreBase: 11
      };
    });

    return [...memoryResults, ...peopleResults, ...placeResults];
  }, [getPersonName, getPlaceName, state.memories, state.people, state.places]);

  const queryTokens = useMemo(() => normalizeSearchText(query).split(" ").filter(Boolean), [query]);
  const results = useMemo(() => {
    if (!queryTokens.length) return [];
    return index
      .map((item) => ({ item, score: scoreSearchResult(item, queryTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || right.item.scoreBase - left.item.scoreBase || left.item.title.localeCompare(right.item.title, "zh-CN"))
      .slice(0, 24)
      .map((entry) => entry.item);
  }, [index, queryTokens]);

  useEffect(() => {
    setSelectedIndex(results.length ? 0 : -1);
  }, [results.length, query]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!results.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(results.length - 1, current + 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        openPath(results[Math.max(0, selectedIndex)]?.path || results[0].path);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, results, selectedIndex]);

  function openPath(path: string) {
    navigate(path);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="global-search-layer" role="dialog" aria-modal="true" aria-label="全局搜索">
      <button className="global-search-backdrop" type="button" aria-label="关闭搜索" onClick={onClose} />
      <section className="global-search-panel">
        <div className="global-search-head">
          <div className="global-search-input">
            <Search />
            <input
              ref={inputRef}
              value={query}
              placeholder="搜索回忆、计划、人物、地点、标签"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button className="search-clear" type="button" aria-label="清除搜索" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>
          <button className="global-search-close" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        {!queryTokens.length ? (
          <div className="global-search-empty">
            <strong>输入关键词开始搜索</strong>
            <span>可以搜索回忆、计划、人物、地点、标签、地址、喜好或平台链接。</span>
          </div>
        ) : results.length ? (
          <div className="global-search-results">
            <div className="global-search-count">找到 {results.length} 条相关结果</div>
            {results.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}`}
                className={`global-search-result glass-card ${index === selectedIndex ? "active" : ""}`}
                type="button"
                onClick={() => openPath(result.path)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={`global-search-icon ${result.kind}`}>
                  {result.kind === "person" && <User />}
                  {result.kind === "place" && <MapPin />}
                  {result.kind === "memory" && <Heart />}
                </span>
                <span className="global-search-result-main">
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <small className="global-search-match">{buildMatchHint(result, queryTokens)}</small>
                </span>
                <span className="global-search-result-meta">
                  <em>{result.kindLabel || kindLabel(result.kind)}</em>
                  <small>{result.meta}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="global-search-no-result glass-card">
            <strong>没有匹配结果</strong>
            <span>换个关键词试试，例如姓名、地点、标签或记录里的关键词。</span>
          </div>
        )}
      </section>
    </div>
  );
}

function scoreSearchResult(result: SearchResult, tokens: string[]) {
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

  return score + result.scoreBase;
}

function buildMatchHint(result: SearchResult, tokens: string[]) {
  const exactFields = new Set<SearchField>();
  const matchedKeywords: SearchKeyword[] = [];

  for (const keyword of result.keywords) {
    const normalized = normalizeSearchText(keyword.value);
    if (!normalized) continue;
    if (tokens.some((token) => normalized.includes(token))) {
      exactFields.add(keyword.field);
      matchedKeywords.push(keyword);
    }
  }

  const first = matchedKeywords.find((item) => item.field !== "标题") || matchedKeywords[0];
  if (!first) return kindLabel(result.kind);

  const fields = Array.from(exactFields).slice(0, 2).join("、");
  return `命中${fields}：${compactMatchText(first.value, tokens)}`;
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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:()[\]{}"'“”‘’/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(value: string) {
  return value.trim().split(/\n|。|！|？|!|\?/)[0]?.trim() || "";
}

function kindLabel(kind: SearchKind) {
  if (kind === "person") return "人物";
  if (kind === "place") return "地点";
  return "记录";
}

function keyword(field: SearchField, value?: string | null): SearchKeyword | null {
  const text = String(value || "").trim();
  return text ? { field, value: text } : null;
}

function isSearchKeyword(value: SearchKeyword | null | undefined | false | ""): value is SearchKeyword {
  return Boolean(value && value.value);
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}
