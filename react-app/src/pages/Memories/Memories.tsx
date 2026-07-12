import { CalendarDays, CheckCircle2, CheckSquare, ChevronDown, Download, Heart, Plus, RotateCcw, SlidersHorizontal, Square, Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BatchActionToolbar from "../../components/BatchActionToolbar";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import ListViewModeToggle from "../../components/ListViewModeToggle";
import MemoryCard from "../../components/MemoryCard";
import EmptyState from "../../components/EmptyState";
import PageSegmentNav from "../../components/PageSegmentNav";
import SearchBar from "../../components/SearchBar";
import SelectPicker from "../../components/SelectPicker";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import type { LifeLogState, MemoryEvent } from "../../types";
import { saveReadableFile } from "../../utils/backupExport";
import { buildReadableMarkdownForSelection } from "../../utils/readableExport";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, getMemoryKindLabel, isActiveMemoryPlan, isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { groupMemoriesByMonth } from "../../utils/detailHelpers";
import { getNotionRecordSyncMeta } from "../../utils/notionStatus";
import { toCalendarDateKey } from "../../utils/calendarItems";
import { WindowedList } from "../../hooks/useWindowedList";

export default function Memories() {
  const {
    state,
    notionSettings,
    notionPageMappings,
    notionSyncQueue,
    getPersonName,
    getPlaceName,
    deleteEntry,
    getDeleteSnapshot,
    restoreDeletedEntry,
    updateMemoriesBulk,
    restoreMemoriesBulk
  } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const { prefs, updatePreference } = useUserPreferences();
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
  const [timeMapOpen, setTimeMapOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const denseList = prefs.listViewMode === "compact";

  const duePlans = useMemo(
    () => state.memories.filter((memory) => isDuePlan(memory, todayKey)).sort((a, b) => b.date.localeCompare(a.date)),
    [state.memories, todayKey]
  );
  const duePlanCount = duePlans.length;
  const primaryDuePlan = duePlans[0];
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
  const selectableMemoryIds = useMemo(() => memories.map((memory) => memory.id), [memories]);
  const selectedMemoryCount = selectedMemoryIds.length;
  const allVisibleMemoriesSelected =
    selectableMemoryIds.length > 0 &&
    selectedMemoryCount === selectableMemoryIds.length &&
    selectableMemoryIds.every((id) => selectedMemoryIds.includes(id));

  useEffect(() => {
    if (!batchMode) return;
    const visibleIdSet = new Set(selectableMemoryIds);
    setSelectedMemoryIds((current) => current.filter((id) => visibleIdSet.has(id)));
  }, [batchMode, selectableMemoryIds]);

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

  function toggleMemorySelection(id: string) {
    setSelectedMemoryIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function closeBatchMode() {
    setBatchMode(false);
    setSelectedMemoryIds([]);
  }

  async function handleBatchDelete() {
    if (!selectedMemoryCount) return;
    const ids = [...selectedMemoryIds];
    const accepted = await confirm({
      title: "批量删除记录",
      message: `确认删除选中的 ${ids.length} 条记录？`,
      confirmText: "删除"
    });
    if (!accepted) return;

    const snapshotResults = await Promise.all(ids.map((id) => getDeleteSnapshot("memory", id)));
    await Promise.all(ids.map((id) => deleteEntry("memory", id)));
    const snapshots = snapshotResults.filter((snapshot) => snapshot !== null);
    closeBatchMode();
    notify({
      message: `已删除 ${ids.length} 条记录`,
      tone: "info",
      actions: snapshots.length
        ? [
            {
              label: "撤销",
              onClick: async () => {
                await Promise.all(snapshots.map((snapshot) => restoreDeletedEntry(snapshot)));
                notify({ message: `已恢复 ${snapshots.length} 条记录`, tone: "success" });
              }
            }
          ]
        : undefined
    });
  }

  async function handleBatchExport() {
    if (!selectedMemoryCount) return;
    const selectedMemories = state.memories.filter((memory) => selectedMemoryIds.includes(memory.id));
    const relatedPersonIds = Array.from(new Set(selectedMemories.flatMap((memory) => memory.personIds || [])));
    const relatedPlaceIds = Array.from(new Set(selectedMemories.flatMap((memory) => getMemoryPlaceIds(memory))));
    const content = buildReadableMarkdownForSelection(state, {
      memories: selectedMemoryIds,
      people: relatedPersonIds,
      places: relatedPlaceIds
    } satisfies Partial<Record<keyof LifeLogState, string[]>>);
    const result = await saveReadableFile(`lifelog-memories-${formatExportDate()}.md`, content, "text/markdown;charset=utf-8");
    notify({
      message: `已导出 ${selectedMemoryCount} 条记录：${result.locationLabel}`,
      tone: "success",
      durationMs: 4200
    });
  }

  async function handleBatchAddTags() {
    if (!selectedMemoryCount) return;
    const tags = parseBatchTags(window.prompt("输入要添加的标签，用逗号、顿号或空格分隔") || "");
    if (!tags.length) return;
    const result = await updateMemoriesBulk(selectedMemoryIds, { appendTags: tags });
    if (!result.count) {
      notify({ message: "选中的记录已经包含这些标签", tone: "info" });
      return;
    }
    notify({
      message: `已给 ${result.count} 条记录添加标签`,
      tone: "success",
      actions: [
        {
          label: "撤销",
          onClick: async () => {
            const restored = await restoreMemoriesBulk(result.before);
            notify({ message: restored ? `已恢复 ${restored} 条记录` : "没有可恢复的记录", tone: restored ? "success" : "info" });
          }
        }
      ]
    });
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
              <strong>{formatDuePlanFocusTitle(duePlanCount)}</strong>
              <span>{primaryDuePlan ? buildDuePlanFocusDesc(primaryDuePlan, getPersonName, getPlaceName) : "集中处理今天到期和已过期的计划。"}</span>
            </div>
            <button type="button" onClick={() => {
              if (duePlanCount === 1 && primaryDuePlan) {
                navigate(`/memories/${primaryDuePlan.id}`);
                return;
              }
              updateFilters({ typeFilter: "due-plan" });
            }}>
              {duePlanCount === 1 ? "去补成回忆" : "集中处理"}
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
            <ListViewModeToggle
              dense={denseList}
              ariaLabel="记录列表密度"
              onChange={(mode) => updatePreference("listViewMode", mode)}
            />
            {memories.length > 0 && (
              <button
                aria-pressed={batchMode}
                className={`filter-toggle-button ${batchMode ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setBatchMode((current) => !current);
                  setSelectedMemoryIds([]);
                }}
              >
                <CheckSquare />
                管理
              </button>
            )}
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
        {batchMode && (
          <BatchActionToolbar
            className="memory-batch-toolbar"
            selectedCount={selectedMemoryCount}
            itemLabel="条记录"
            hint="可统一导出、追加标签，或集中清理重复和误记。"
            allSelected={allVisibleMemoriesSelected}
            onToggleAll={() => setSelectedMemoryIds(allVisibleMemoriesSelected ? [] : selectableMemoryIds)}
            onClose={closeBatchMode}
            actions={[
              { id: "export", label: "导出", icon: <Download size={14} />, disabled: !selectedMemoryCount, onClick: () => void handleBatchExport() },
              { id: "tags", label: "加标签", icon: <Tags size={14} />, disabled: !selectedMemoryCount, onClick: () => void handleBatchAddTags() },
              { id: "delete", label: "删除", icon: <Trash2 size={14} />, tone: "danger", disabled: !selectedMemoryCount, onClick: () => void handleBatchDelete() }
            ]}
          />
        )}
        {yearMapItems.length > 1 && (
          <div className={`memory-time-map ${timeMapOpen ? "open" : ""}`} aria-label="记录时间地图">
            <button className="memory-time-map-summary" type="button" aria-expanded={timeMapOpen} onClick={() => setTimeMapOpen((open) => !open)}>
              <span>
                <strong>时间地图</strong>
                <small>{yearMapItems.length} 个年份 · {memories.length} 条记录</small>
              </span>
              <em>
                {timeMapOpen ? "收起" : "按年份跳转"}
                <ChevronDown />
              </em>
            </button>
            {timeMapOpen && (
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
            )}
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
                  <WindowedList
                    items={group.memories}
                    estimateSize={denseList ? 88 : 112}
                    threshold={48}
                    getKey={(memory) => memory.id}
                    renderItem={(memory) => {
                    const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
                    const selected = selectedMemoryIds.includes(memory.id);
                    return (
                      <MemoryCard
                        memory={memory}
                        ctx={ctx}
                        className={`${batchMode ? "selectable" : ""} ${selected ? "selected" : ""}`}
                        onOpen={() => {
                          if (batchMode) {
                            toggleMemorySelection(memory.id);
                            return;
                          }
                          navigate(`/memories/${memory.id}`);
                        }}
                        showPhotoCount
                        collapseExtras
                        dense={denseList}
                        showThumb={!denseList}
                        syncMeta={getNotionRecordSyncMeta({
                          enabled: Boolean(notionSettings.enabled && notionSettings.memoriesDatabaseId),
                          entityType: "memory",
                          entityId: memory.id,
                          mappings: notionPageMappings,
                          queue: notionSyncQueue
                        })}
                        selectionControl={
                          batchMode ? (
                            <button
                              className="memory-select-toggle"
                              type="button"
                              aria-pressed={selected}
                              aria-label={selected ? "取消选择记录" : "选择记录"}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleMemorySelection(memory.id);
                              }}
                            >
                              {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          ) : null
                        }
                        actions={
                          batchMode ? null : (
                            <CardActions onEdit={() => setEditingId(memory.id)} onDelete={() => handleDelete(memory.id)} />
                          )
                        }
                      />
                    );
                    }}
                  />
                </div>
              </div>
            );
          })}
          {!memories.length &&
            (state.memories.length === 0 ? (
              <EmptyState
                icon={<Heart />}
                title="还没有记录"
                description="先写今天的一件小事。人物、地点和照片之后再补也行。"
                primaryAction={{ label: "记一件事", onClick: () => setCreatingNew(true) }}
              />
            ) : (
              <EmptyState
                icon={<RotateCcw />}
                title="没有找到匹配记录"
                description="试试放宽筛选，或换个人名、地点、心情关键词。"
                primaryAction={{ label: "清除筛选", onClick: clearFilters, primary: false }}
              />
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

function formatDuePlanFocusTitle(count: number) {
  return count === 1 ? "有一条计划可以补成回忆" : `${count} 条计划可以补成回忆`;
}

function buildDuePlanFocusDesc(
  memory: MemoryEvent,
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
) {
  const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
  const title = getMemoryDisplayTitle(memory, ctx);
  const relation = [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ");
  return [title, relation].filter(Boolean).join(" · ") || "打开后可以补上实际发生的事。";
}

function isDuePlan(memory: MemoryEvent, todayKey: string) {
  return isActiveMemoryPlan(memory) && /^\d{4}-\d{2}-\d{2}$/.test(memory.date) && memory.date <= todayKey;
}

function parseImportedIds(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBatchTags(value: string) {
  return Array.from(new Set(value.split(/[\s,，、;；]+/).map((tag) => tag.trim()).filter(Boolean)));
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
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
