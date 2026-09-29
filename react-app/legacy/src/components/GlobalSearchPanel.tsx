import { Clock3, Heart, MapPin, Search, Sparkles, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeLog } from "../context/LifeLogContext";
import { usePersistentState } from "../hooks/usePersistentState";
import { formatMonthDay } from "../utils/date";
import { buildMemoryDisplayContext, buildMemoryMetaLine, getMemoryDisplayTitle, getMemoryKindLabel, isMemoryPlan } from "../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../utils/memoryPlaces";
import { buildPlaceContextLine, buildPlaceDisplayName } from "../utils/placeMeta";
import {
  buildMatchHint,
  isSearchKeyword,
  keyword,
  kindLabel,
  normalizeSearchText,
  parseSearchQuery,
  rankSearchResults,
  type SearchResult
} from "../utils/globalSearch";
import { getSearchResultCountBucket, recordUxMetric } from "../utils/uxMetrics";
import { buildSearchResultRouteState } from "../utils/searchNavigation";

const RECENT_SEARCH_LIMIT = 8;

const SEARCH_SYNTAX_HINTS = [
  { label: "@人名", example: "@", desc: "快速锁定人物相关结果" },
  { label: "日期", example: "2024-05-01", desc: "按完整日期查找记录" },
  { label: "年月", example: "2024-05", desc: "按月份浏览回忆" },
  { label: "标签", example: "旅行", desc: "按标签或心情关键词搜" }
] as const;

export default function GlobalSearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, settings, getPersonName, getPlaceName } = useLifeLog();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = usePersistentState<string[]>("lifelog:recent-searches", [], isStringArray);
  const privacyMode = Boolean(settings.privacyMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchStartedAtRef = useRef(0);
  const searchRecordedRef = useRef(false);
  const resultCountRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function handleResumeSearch(event: Event) {
      const query = (event as CustomEvent<{ query?: unknown }>).detail?.query;
      if (typeof query === "string") setQuery(query);
    }
    window.addEventListener("lifelog:resume-global-search", handleResumeSearch);
    return () => window.removeEventListener("lifelog:resume-global-search", handleResumeSearch);
  }, []);

  useEffect(() => {
    if (privacyMode && recentSearches.length) {
      setRecentSearches([]);
    }
  }, [privacyMode, recentSearches.length, setRecentSearches]);

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
        scoreBase: person.favorite ? 14 : 10,
        personNames: [person.name, person.nickname].filter(Boolean).map(String)
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
        scoreBase: 11,
        date: memory.date,
        personIds: memory.personIds || [],
        personNames: ctx.personNames || []
      };
    });

    return [...memoryResults, ...peopleResults, ...placeResults];
  }, [getPersonName, getPlaceName, state.memories, state.people, state.places]);

  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);
  const overview = useMemo(
    () => ({
      memories: state.memories.length,
      people: state.people.length,
      places: state.places.length
    }),
    [state.memories.length, state.people.length, state.places.length]
  );
  const suggestions = useMemo(() => buildSearchSuggestions(state, getPersonName, getPlaceName), [getPersonName, getPlaceName, state.memories, state.people, state.places]);
  const results = useMemo(() => rankSearchResults(index, parsedQuery), [index, parsedQuery]);
  resultCountRef.current = results.length;

  useEffect(() => {
    if (open) {
      searchStartedAtRef.current = performance.now();
      searchRecordedRef.current = false;
      return;
    }
    recordSearchOutcome("abandoned");
    searchStartedAtRef.current = 0;
  }, [open]);

  const sectionedResults = useMemo(() => {
    const people = results.filter((item) => item.kind === "person");
    const places = results.filter((item) => item.kind === "place");
    const memories = results.filter((item) => item.kind === "memory");
    if (parsedQuery.mentionNames.length) {
      return [
        { key: "person", label: "人物", items: people },
        { key: "memory", label: "相关记录", items: memories },
        { key: "place", label: "地点", items: places }
      ].filter((section) => section.items.length);
    }
    if (parsedQuery.exactDates.length || parsedQuery.yearMonths.length) {
      return [
        { key: "memory", label: "记录", items: memories },
        { key: "person", label: "人物", items: people },
        { key: "place", label: "地点", items: places }
      ].filter((section) => section.items.length);
    }
    return [
      { key: "memory", label: "记录", items: memories },
      { key: "person", label: "人物", items: people },
      { key: "place", label: "地点", items: places }
    ].filter((section) => section.items.length);
  }, [parsedQuery.exactDates.length, parsedQuery.mentionNames.length, parsedQuery.yearMonths.length, results]);

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
        openResult(results[Math.max(0, selectedIndex)] || results[0]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, results, selectedIndex]);

  function openResult(result: SearchResult) {
    recordSearchOutcome("selected");
    saveRecentSearch(query);
    navigate(result.path, { state: buildSearchResultRouteState(result.kind, result.id, query) });
    onClose();
  }

  function recordSearchOutcome(outcome: "selected" | "abandoned") {
    if (!searchStartedAtRef.current || searchRecordedRef.current) return;
    searchRecordedRef.current = true;
    recordUxMetric({
      event: "search_flow",
      resultCount: getSearchResultCountBucket(resultCountRef.current),
      outcome,
      durationMs: performance.now() - searchStartedAtRef.current
    });
  }

  function saveRecentSearch(value: string) {
    if (privacyMode) return;
    const text = value.trim();
    if (!text) return;
    const normalized = normalizeSearchText(text);
    setRecentSearches((current) => [text, ...current.filter((item) => normalizeSearchText(item) !== normalized)].slice(0, RECENT_SEARCH_LIMIT));
  }

  function applyQuery(value: string) {
    setQuery(value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
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
              placeholder="搜索回忆、计划、人物、地点、标签 · 可用 @人名 或 2024-05-01"
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

        {!parsedQuery.tokens.length && !parsedQuery.hasSemanticFilter ? (
          <div className="global-search-empty">
            <div className="global-search-empty-card glass-card">
              <strong>想找什么都可以直接搜</strong>
              <span>支持回忆、计划、人物、地点、标签、地址、喜好和平台链接。</span>
              <div className="global-search-stats" aria-label="数据概览">
                <span>
                  <strong>{overview.memories}</strong>
                  <small>记录</small>
                </span>
                <span>
                  <strong>{overview.people}</strong>
                  <small>人物</small>
                </span>
                <span>
                  <strong>{overview.places}</strong>
                  <small>地点</small>
                </span>
              </div>
            </div>
            <div className="global-search-section">
              <div className="global-search-section-head">
                <span>
                  <Sparkles />
                  搜索语法
                </span>
              </div>
              <div className="global-search-chips global-search-syntax-chips">
                {SEARCH_SYNTAX_HINTS.map((item) => (
                  <button type="button" key={item.example} onClick={() => applyQuery(item.example)} title={item.desc}>
                    <em>{item.label}</em>
                    <span>{item.example}</span>
                  </button>
                ))}
              </div>
              {privacyMode ? <p className="global-search-privacy-note">隐私模式已开启，不会保存最近搜索。</p> : null}
            </div>
            {!privacyMode && recentSearches.length > 0 && (
              <div className="global-search-section">
                <div className="global-search-section-head">
                  <span>
                    <Clock3 />
                    最近搜索
                  </span>
                  <button type="button" onClick={() => setRecentSearches([])}>
                    清空
                  </button>
                </div>
                <div className="global-search-chips">
                  {recentSearches.map((item) => (
                    <button type="button" key={item} onClick={() => applyQuery(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="global-search-section">
                <div className="global-search-section-head">
                  <span>
                    <Sparkles />
                    推荐搜索
                  </span>
                </div>
                <div className="global-search-chips">
                  {suggestions.map((item) => (
                    <button type="button" key={item} onClick={() => applyQuery(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : results.length ? (
          <div className="global-search-results">
            <div className="global-search-count">
              找到 {results.length} 条相关结果
              {parsedQuery.mentionNames.length ? ` · @${parsedQuery.mentionNames.join("、")}` : ""}
              {parsedQuery.exactDates[0]
                ? ` · ${parsedQuery.exactDates[0]}`
                : parsedQuery.yearMonths[0]
                  ? ` · ${parsedQuery.yearMonths[0]}`
                  : ""}
            </div>
            {sectionedResults.map((section) => (
              <div className="global-search-section-block" key={section.key}>
                <div className="global-search-section-label">{section.label}</div>
                {section.items.map((result) => {
                  const index = results.findIndex((item) => item.kind === result.kind && item.id === result.id);
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      className={`global-search-result glass-card ${index === selectedIndex ? "active" : ""}`}
                      type="button"
                      onClick={() => openResult(result)}
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
                        <small className="global-search-match">{buildMatchHint(result, parsedQuery)}</small>
                      </span>
                      <span className="global-search-result-meta">
                        <em>{result.kindLabel || kindLabel(result.kind)}</em>
                        <small>{result.meta}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="global-search-no-result glass-card">
            <strong>没有匹配结果</strong>
            <span>
              {parsedQuery.mentionNames.length
                ? "没有找到该人物或相关记录，试试完整姓名，或去掉 @ 做全文搜索。"
                : parsedQuery.exactDates.length || parsedQuery.yearMonths.length
                  ? "这个日期附近没有记录，换一天或改成年月再试。"
                  : "换个关键词试试，例如姓名、地点、标签，或用 @人名 / 2024-05-01。"}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function firstLine(value: string) {
  return value.trim().split(/\n|。|！|？|!|\?/)[0]?.trim() || "";
}

function buildSearchSuggestions(
  state: ReturnType<typeof useLifeLog>["state"],
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
) {
  const values: string[] = [];

  for (const person of state.people) {
    if (person.favorite || values.length < 3) {
      values.push(person.name, person.nickname || "", person.relationship || "");
      if (person.name.trim()) values.push(`@${person.name.trim()}`);
    }
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  values.push(monthKey);

  for (const place of state.places) {
    if (place.favorite || values.length < 7) values.push(buildPlaceDisplayName(place), place.category || "", place.mall || "");
  }

  for (const memory of state.memories.slice(0, 24)) {
    values.push(memory.mood || "", getMemoryKindLabel(memory));
    values.push(...safeArray(memory.tags));
    values.push(...safeArray(memory.personIds).map(getPersonName));
    values.push(...getMemoryPlaceIds(memory).map(getPlaceName));
  }

  return uniqueSearchTerms(values).slice(0, 10);
}

function uniqueSearchTerms(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const normalized = normalizeSearchText(text);
    if (!normalized || normalized.length < 2 || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(text);
  }
  return result;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
