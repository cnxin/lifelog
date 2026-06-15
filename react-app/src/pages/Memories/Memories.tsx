import { CalendarDays, CheckCircle2, Heart, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import PageSegmentNav from "../../components/PageSegmentNav";
import SearchBar from "../../components/SearchBar";
import SelectPicker from "../../components/SelectPicker";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import type { MemoryEvent } from "../../types";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, getMemoryKindLabel, isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { groupMemoriesByMonth } from "../../utils/detailHelpers";
import { getNotionRecordSyncMeta } from "../../utils/notionStatus";
import { toCalendarDateKey } from "../../utils/calendarItems";

export default function Memories() {
  const { state, notionSettings, notionPageMappings, notionSyncQueue, getPersonName, getPlaceName, deleteEntry, getDeleteSnapshot, restoreDeletedEntry } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const importedMemoryIds = useMemo(() => parseImportedIds(searchParams.get("imported")), [searchParams]);
  const importedMemoryIdSet = useMemo(() => new Set(importedMemoryIds), [importedMemoryIds]);
  const [filters, setFilters] = usePersistentState<MemoryFilterState>(
    "lifelog:filters:memories",
    { query: "", typeFilter: "", personFilter: "", placeFilter: "", moodFilter: "", tagFilter: "" },
    isMemoryFilterState
  );
  const query = filters.query;
  const typeFilter = filters.typeFilter || "";
  const personFilter = filters.personFilter;
  const placeFilter = filters.placeFilter;
  const moodFilter = filters.moodFilter;
  const tagFilter = filters.tagFilter;
  const todayKey = toCalendarDateKey(new Date());
  const activeAdvancedFilterCount = [typeFilter, personFilter, placeFilter, moodFilter, tagFilter].filter(Boolean).length;
  const hasAdvancedFilters = activeAdvancedFilterCount > 0;
  const [filtersOpen, setFiltersOpen] = useState(hasAdvancedFilters);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);

  const duePlanCount = useMemo(() => state.memories.filter((memory) => isDuePlan(memory, todayKey)).length, [state.memories, todayKey]);
  const filterOptions = useMemo(() => buildFilterOptions(state.memories, getPersonName, getPlaceName), [state.memories, getPersonName, getPlaceName]);
  const hasActiveFilters = Boolean(query.trim() || hasAdvancedFilters);
  const activeFilterLabels = buildActiveFilterLabels({
    query: query.trim(),
    type: typeFilter,
    person: personFilter ? getPersonName(personFilter) : "",
    place: placeFilter ? getPlaceName(placeFilter) : "",
    mood: moodFilter,
    tag: tagFilter
  });

  const memories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...state.memories]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((memory) => {
        if (importedMemoryIdSet.size && !importedMemoryIdSet.has(memory.id)) return false;
        const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
        const content = [
          memory.title,
          getMemoryDisplayTitle(memory, ctx),
          memory.content,
          memory.mood,
          getMemoryKindLabel(memory),
          ctx.personNames.join(","),
          ctx.placeName,
          (memory.tags || []).join(",")
        ].join(" ").toLowerCase();

        if (normalizedQuery && !content.includes(normalizedQuery)) return false;
        if (typeFilter === "plan" && !isMemoryPlan(memory)) return false;
        if (typeFilter === "due-plan" && !isDuePlan(memory, todayKey)) return false;
        if (typeFilter === "memory" && isMemoryPlan(memory)) return false;
        if (personFilter && !(memory.personIds || []).includes(personFilter)) return false;
        if (placeFilter && !getMemoryPlaceIds(memory).includes(placeFilter)) return false;
        if (moodFilter && memory.mood !== moodFilter) return false;
        if (tagFilter && !(memory.tags || []).includes(tagFilter)) return false;
        return true;
      });
  }, [getPersonName, getPlaceName, importedMemoryIdSet, moodFilter, personFilter, placeFilter, query, state.memories, tagFilter, todayKey, typeFilter]);
  const groupedMemories = useMemo(() => groupMemoriesByMonth(memories), [memories]);
  const yearAnchors = useMemo(() => buildYearAnchors(groupedMemories), [groupedMemories]);
  const yearMapItems = useMemo(() => buildYearMapItems(groupedMemories), [groupedMemories]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除记录",
      message: "确认删除这条记录？",
      confirmText: "删除"
    });
    if (!accepted) return;
    const snapshot = await getDeleteSnapshot("memory", id);
    await deleteEntry("memory", id);
    if (snapshot) {
      notify({
        message: "记录已删除",
        tone: "info",
        actions: [
          {
            label: "撤销",
            onClick: async () => {
              await restoreDeletedEntry(snapshot);
              notify({ message: "记录已恢复", tone: "success" });
            }
          }
        ]
      });
    }
  }

  function clearFilters() {
    setFilters({ query: "", typeFilter: "", personFilter: "", placeFilter: "", moodFilter: "", tagFilter: "" });
    setFiltersOpen(false);
  }

  function updateFilters(patch: Partial<MemoryFilterState>) {
    setFilters({ ...filters, ...patch });
  }

  function clearImportedView() {
    const next = new URLSearchParams(searchParams);
    next.delete("imported");
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <PageSegmentNav
        ariaLabel="记录视图"
        items={[
          { to: "/memories", label: "时间线", icon: <Heart />, end: true },
          { to: "/calendar", label: "日历", icon: <CalendarDays /> }
        ]}
      />
      <SearchBar value={query} placeholder="搜索标题、正文、人物、地点、心情或标签" onChange={(query) => updateFilters({ query })} />
      {importedMemoryIds.length > 0 && (
        <section className="section imported-focus-section">
          <GlassCard className="imported-focus-card">
            <div>
              <strong>刚导入的记录</strong>
              <span>已临时筛出 {memories.length} 条刚添加的记录，便于检查内容。</span>
            </div>
            <button className="mini-action" type="button" onClick={clearImportedView}>
              查看全部
            </button>
          </GlassCard>
        </section>
      )}
      {duePlanCount > 0 && typeFilter !== "due-plan" && !importedMemoryIds.length && (
        <section className="section due-plan-focus-section">
          <GlassCard className="due-plan-focus-card">
            <div className="due-plan-focus-icon">
              <CheckCircle2 />
            </div>
            <div>
              <strong>{duePlanCount} 条计划可以补成回忆</strong>
              <span>集中处理今天到期和已过期的计划。</span>
            </div>
            <button type="button" onClick={() => updateFilters({ typeFilter: "due-plan" })}>
              去处理
            </button>
          </GlassCard>
        </section>
      )}
      <section className="section memory-filter-section compact-filter-section">
        <div className="list-filter-toolbar">
          <div className="list-filter-summary">
            <span>
              显示 {memories.length} / {state.memories.length} 条记录
            </span>
          </div>
          <div className="list-filter-actions">
            {hasActiveFilters && (
              <button className="filter-clear-button" type="button" onClick={clearFilters}>
                <RotateCcw /> 清除
              </button>
            )}
            <button
              aria-expanded={filtersOpen}
              className={`filter-toggle-button ${filtersOpen ? "active" : ""}`}
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal />
              筛选{activeAdvancedFilterCount ? ` ${activeAdvancedFilterCount}` : ""}
            </button>
          </div>
        </div>
        {activeFilterLabels.length > 0 && (
          <div className="list-filter-chips">
            {activeFilterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
        {filtersOpen && (
          <div className="advanced-filter-panel memory-filter-grid">
            <SelectPicker
              label="筛选类型"
              value={typeFilter}
              onChange={(typeFilter) => updateFilters({ typeFilter })}
              placeholder="全部记录"
              options={[
                { value: "", label: "全部记录" },
                { value: "memory", label: "只看回忆" },
                { value: "plan", label: "只看计划" },
                { value: "due-plan", label: "待补成回忆" }
              ]}
            />
            <SelectPicker
              label="筛选人物"
              value={personFilter}
              onChange={(personFilter) => updateFilters({ personFilter })}
              placeholder="全部人物"
              options={[{ value: "", label: "全部人物" }, ...filterOptions.people]}
            />
            <SelectPicker
              label="筛选地点"
              value={placeFilter}
              onChange={(placeFilter) => updateFilters({ placeFilter })}
              placeholder="全部地点"
              options={[{ value: "", label: "全部地点" }, ...filterOptions.places]}
            />
            <SelectPicker
              label="筛选心情"
              value={moodFilter}
              onChange={(moodFilter) => updateFilters({ moodFilter })}
              placeholder="全部心情"
              options={[{ value: "", label: "全部心情" }, ...filterOptions.moods]}
            />
            <SelectPicker
              label="筛选标签"
              value={tagFilter}
              onChange={(tagFilter) => updateFilters({ tagFilter })}
              placeholder="全部标签"
              options={[{ value: "", label: "全部标签" }, ...filterOptions.tags]}
            />
          </div>
        )}
      </section>
      <section className="section">
        {yearMapItems.length > 0 && (
          <div className="memory-time-map" aria-label="记录时间地图">
            <div className="memory-time-map-head">
              <strong>时间地图</strong>
              <span>{yearMapItems.length} 个年份 · {memories.length} 条</span>
            </div>
            <div className="memory-time-map-track">
              {yearMapItems.map((item) => (
                <a
                  href={`#memory-year-${item.year}`}
                  key={item.year}
                  style={{ "--density": item.density } as CSSProperties}
                  title={`${item.year} · ${item.count} 条记录`}
                >
                  <span />
                  <em>{item.year}</em>
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="memory-timeline-list">
          {groupedMemories.map((group) => {
            const year = extractYear(group.month);
            return (
              <div className="memory-timeline-month" id={isFirstYearGroup(groupedMemories, group.month) ? `memory-year-${year}` : undefined} key={group.month}>
                <div className="memory-timeline-title">
                  <strong>{group.month}</strong>
                  <span>{group.memories.length} 条</span>
                </div>
                <div className="list">
                  {group.memories.map((memory) => {
                    const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
                    return (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        ctx={ctx}
                        onOpen={() => navigate(`/memories/${memory.id}`)}
                        showPhotoCount
                        syncMeta={getNotionRecordSyncMeta({
                          enabled: Boolean(notionSettings.enabled && notionSettings.memoriesDatabaseId),
                          entityType: "memory",
                          entityId: memory.id,
                          mappings: notionPageMappings,
                          queue: notionSyncQueue
                        })}
                        actions={<CardActions onEdit={() => setEditingId(memory.id)} onDelete={() => handleDelete(memory.id)} />}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!memories.length &&
            (state.memories.length === 0 ? (
              <GlassCard className="empty empty-cta">
                <p>还没有记录</p>
                <button className="primary-btn" onClick={() => setCreatingNew(true)}>
                  <Plus size={16} /> 记录第一条
                </button>
              </GlassCard>
            ) : (
              <GlassCard className="empty empty-cta">
                <p>没有找到匹配记录</p>
                <button className="primary-btn" onClick={clearFilters}>
                  <RotateCcw size={16} /> 清除筛选
                </button>
              </GlassCard>
            ))}
        </div>
      </section>
      <EntrySheet type={editingId ? "memory" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
      <EntrySheet type={creatingNew ? "memory" : null} memoryMode="quick" onClose={() => setCreatingNew(false)} />
    </>
  );
}

interface MemoryFilterState {
  query: string;
  typeFilter: string;
  personFilter: string;
  placeFilter: string;
  moodFilter: string;
  tagFilter: string;
}

function isMemoryFilterState(value: unknown): value is MemoryFilterState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MemoryFilterState>;
  return (
    typeof candidate.query === "string" &&
    (candidate.typeFilter === undefined || typeof candidate.typeFilter === "string") &&
    typeof candidate.personFilter === "string" &&
    typeof candidate.placeFilter === "string" &&
    typeof candidate.moodFilter === "string" &&
    typeof candidate.tagFilter === "string"
  );
}

function buildYearAnchors(groups: Array<{ month: string; memories: MemoryEvent[] }>) {
  return Array.from(new Set(groups.map((group) => extractYear(group.month)).filter(Boolean)));
}

function buildYearMapItems(groups: Array<{ month: string; memories: MemoryEvent[] }>) {
  const counts = new Map<string, number>();
  groups.forEach((group) => {
    const year = extractYear(group.month);
    if (!year) return;
    counts.set(year, (counts.get(year) || 0) + group.memories.length);
  });
  const max = Math.max(...counts.values(), 1);
  return buildYearAnchors(groups).map((year) => ({
    year,
    count: counts.get(year) || 0,
    density: Math.max(0.18, (counts.get(year) || 0) / max)
  }));
}

function extractYear(monthLabel: string) {
  const match = monthLabel.match(/\d{4}/);
  return match?.[0] || monthLabel;
}

function isFirstYearGroup(groups: Array<{ month: string; memories: MemoryEvent[] }>, month: string) {
  const year = extractYear(month);
  return groups.find((group) => extractYear(group.month) === year)?.month === month;
}

function buildActiveFilterLabels(filters: {
  query: string;
  type: string;
  person: string;
  place: string;
  mood: string;
  tag: string;
}) {
  return [
    filters.query ? `搜索：${filters.query}` : "",
    filters.type ? `类型：${formatTypeFilterLabel(filters.type)}` : "",
    filters.person ? `人物：${filters.person}` : "",
    filters.place ? `地点：${filters.place}` : "",
    filters.mood ? `心情：${filters.mood}` : "",
    filters.tag ? `标签：${filters.tag}` : ""
  ].filter(Boolean);
}

function formatTypeFilterLabel(value: string) {
  if (value === "plan") return "计划";
  if (value === "due-plan") return "待补成回忆";
  return "回忆";
}

function isDuePlan(memory: MemoryEvent, todayKey: string) {
  return isMemoryPlan(memory) && /^\d{4}-\d{2}-\d{2}$/.test(memory.date) && memory.date <= todayKey;
}

function parseImportedIds(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFilterOptions(memories: MemoryEvent[], getPersonName: (id: string) => string, getPlaceName: (id: string) => string) {
  const people = new Map<string, string>();
  const places = new Map<string, string>();
  const moods = new Set<string>();
  const tags = new Set<string>();

  memories.forEach((memory) => {
    (memory.personIds || []).forEach((personId) => {
      const name = getPersonName(personId);
      if (name) people.set(personId, name);
    });
    getMemoryPlaceIds(memory).forEach((placeId) => {
      const placeName = getPlaceName(placeId);
      if (placeName) places.set(placeId, placeName);
    });
    if (memory.mood) moods.add(memory.mood);
    (memory.tags || []).filter(Boolean).forEach((tag) => tags.add(tag));
  });

  return {
    people: mapToOptions(people),
    places: mapToOptions(places),
    moods: setToOptions(moods),
    tags: setToOptions(tags)
  };
}

function mapToOptions(items: Map<string, string>) {
  return Array.from(items, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

function setToOptions(items: Set<string>) {
  return Array.from(items)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((item) => ({ value: item, label: item }));
}
