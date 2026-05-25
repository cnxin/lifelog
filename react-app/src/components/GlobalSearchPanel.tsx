import { CalendarDays, Heart, MapPin, Search, User, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeLog } from "../context/LifeLogContext";
import { formatMonthDay } from "../utils/date";
import { buildMemoryDisplayContext, buildMemoryMetaLine, getMemoryDisplayTitle } from "../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../utils/memoryPlaces";
import { buildPlaceContextLine, buildPlaceDisplayName } from "../utils/placeMeta";

type SearchKind = "memory" | "person" | "place";

interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  meta: string;
  path: string;
  searchText: string;
  keywords: string[];
  scoreBase: number;
}

const quickLinks = [
  { label: "回忆", desc: "查标题、正文、标签", path: "/memories", icon: Heart },
  { label: "人物", desc: "查姓名、关系、喜好", path: "/people", icon: Users },
  { label: "地点", desc: "查店铺、区域、平台", path: "/places", icon: MapPin },
  { label: "日历", desc: "按日期回看记录", path: "/calendar", icon: CalendarDays }
];

export default function GlobalSearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setQuery("");
  }, [open]);

  const index = useMemo<SearchResult[]>(() => {
    const personById = new Map(state.people.map((person) => [person.id, person]));
    const placeById = new Map(state.places.map((place) => [place.id, place]));

    const peopleResults = state.people.map<SearchResult>((person) => {
      const preferenceText = [...safeArray(person.preferences), ...safeArray(person.dislikes)]
        .flatMap((group) => [group.category, ...group.items])
        .filter(Boolean)
        .join(" ");
      const anniversaries = safeArray(person.anniversaries).map((item) => `${item.title} ${item.date}`).join(" ");
      const keywords = [
        person.name,
        person.nickname,
        person.relationship,
        person.favorite ? "收藏" : "",
        preferenceText,
        anniversaries,
        person.notes
      ].filter(Boolean) as string[];
      return {
        id: person.id,
        kind: "person",
        title: person.name || "未命名人物",
        subtitle: [person.nickname, person.relationship].filter(Boolean).join(" · ") || "人物档案",
        meta: person.favorite ? "已收藏" : safeArray(person.anniversaries).length ? `${safeArray(person.anniversaries).length} 个纪念日` : "人物",
        path: `/people/${person.id}`,
        searchText: normalizeSearchText(keywords.join(" ")),
        keywords,
        scoreBase: person.favorite ? 14 : 10
      };
    });

    const placeResults = state.places.map<SearchResult>((place) => {
      const title = buildPlaceDisplayName(place) || "未命名地点";
      const platformText = safeArray(place.platformLinks).map((link) => `${link.label} ${link.platform} ${link.url}`).join(" ");
      const keywords = [
        title,
        place.name,
        place.storeName,
        place.category,
        place.country,
        place.province,
        place.city,
        place.area,
        place.mall,
        place.address,
        place.desc,
        place.mapUrl,
        place.sourceUrl,
        platformText,
        ...safeArray(place.tags),
        place.favorite ? "收藏" : ""
      ].filter(Boolean);
      return {
        id: place.id,
        kind: "place",
        title,
        subtitle: buildPlaceContextLine(place),
        meta: [place.category, place.rating ? `${place.rating} 分` : "", place.favorite ? "已收藏" : ""].filter(Boolean).join(" · ") || "地点",
        path: `/places/${place.id}`,
        searchText: normalizeSearchText(keywords.join(" ")),
        keywords,
        scoreBase: place.favorite ? 13 : 9
      };
    });

    const memoryResults = state.memories.map<SearchResult>((memory) => {
      const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
      const title = getMemoryDisplayTitle(memory, ctx);
      const people = (memory.personIds || []).map((id) => personById.get(id)).filter(Boolean);
      const places = getMemoryPlaceIds(memory).map((id) => placeById.get(id)).filter(Boolean);
      const keywords = [
        title,
        memory.title,
        memory.content,
        memory.mood,
        memory.date,
        ...ctx.personNames,
        ...ctx.placeNames,
        ...people.flatMap((person) => [person?.nickname, person?.relationship, person?.notes]),
        ...places.flatMap((place) => [place?.category, place?.city, place?.area, place?.mall, place?.address]),
        ...(memory.tags || [])
      ].filter(Boolean) as string[];
      return {
        id: memory.id,
        kind: "memory",
        title,
        subtitle: buildMemoryMetaLine(ctx) || firstLine(memory.content) || "回忆记录",
        meta: [formatMonthDay(memory.date), memory.mood, safeArray(memory.photos).length ? `${safeArray(memory.photos).length} 张照片` : ""].filter(Boolean).join(" · "),
        path: `/memories/${memory.id}`,
        searchText: normalizeSearchText(keywords.join(" ")),
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
              placeholder="搜索回忆、人物、地点、标签"
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
            <span>快速跳转</span>
            <div className="global-search-quick-grid">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button key={link.path} className="global-search-quick" type="button" onClick={() => openPath(link.path)}>
                    <Icon />
                    <strong>{link.label}</strong>
                    <small>{link.desc}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ) : results.length ? (
          <div className="global-search-results">
            <div className="global-search-count">找到 {results.length} 条相关结果</div>
            {results.map((result) => (
              <button key={`${result.kind}-${result.id}`} className="global-search-result glass-card" type="button" onClick={() => openPath(result.path)}>
                <span className={`global-search-icon ${result.kind}`}>
                  {result.kind === "person" && <User />}
                  {result.kind === "place" && <MapPin />}
                  {result.kind === "memory" && <Heart />}
                </span>
                <span className="global-search-result-main">
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
                <span className="global-search-result-meta">
                  <em>{kindLabel(result.kind)}</em>
                  <small>{result.meta}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="global-search-no-result glass-card">
            <strong>没有匹配结果</strong>
            <span>换个关键词试试，例如姓名、地点、标签或回忆里的关键词。</span>
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
  return "回忆";
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}
