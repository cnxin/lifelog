import { Building2, CheckSquare, GitMerge, MapPin, Plus, RotateCcw, Share2, SlidersHorizontal, Square, Star, Store, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import LocalShareSheet from "../../components/LocalShareSheet";
import NotionSyncBadge from "../../components/NotionSyncBadge";
import PageSegmentNav from "../../components/PageSegmentNav";
import PlaceMergeWorkbench from "../../components/PlaceMergeWorkbench";
import SearchBar from "../../components/SearchBar";
import SelectPicker from "../../components/SelectPicker";
import Tags from "../../components/Tags";
import type { Place, PlaceDuplicateGroup, PlaceMergePreview } from "../../types";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import { usePlaceLocationFilter } from "../../hooks/usePlaceLocationFilter";
import { buildGroupMergePreview } from "../../utils/placeDedup";
import { getNotionRecordSyncMeta } from "../../utils/notionStatus";
import { buildMallVisitStats, buildPlaceVisitStats, type MallVisitStats, type PlaceVisitStats } from "../../utils/placeVisitStats";
import {
  buildMallKey,
  buildPlaceContextLine,
  buildPlaceDisplayName,
  buildPlaceGeoLine,
  getPlaceMallName,
  isMallRecord,
} from "../../utils/placeMeta";

type PlaceSortMode = "smart" | "recent" | "rating" | "name";
interface PlaceFilterState {
  query: string;
  country: string;
  province: string;
  city: string;
  area: string;
  category: string;
  sortMode: PlaceSortMode;
}

interface PlaceBatchDraft {
  category: string;
  mall: string;
  area: string;
  tags: string;
}

export default function Places() {
  const {
    state,
    notionSettings,
    notionPageMappings,
    notionSyncQueue,
    deleteEntry,
    getDeleteSnapshot,
    restoreDeletedEntry,
    duplicatePlaceGroups,
    placeMergeHistory,
    latestPlaceMerge,
    mergePlacePreview,
    mergeDuplicatePlaces,
    mergeAllDuplicatePlaces,
    undoLatestPlaceMerge,
    togglePlaceFavorite,
    updatePlacesBulk,
    restorePlacesBulk,
    getPersonName,
  } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const importedPlaceIds = useMemo(() => parseImportedIds(searchParams.get("imported")), [searchParams]);
  const importedPlaceIdSet = useMemo(() => new Set(importedPlaceIds), [importedPlaceIds]);
  const [filters, setFilters] = usePersistentState<PlaceFilterState>(
    "lifelog:filters:places",
    {
      query: "",
      country: "全部",
      province: "全部",
      city: "全部",
      area: "全部",
      category: "全部",
      sortMode: "smart"
    },
    isPlaceFilterState
  );
  const locationFilter = usePlaceLocationFilter(state.places, filters);
  const {
    country,
    province,
    city,
    area,
    setCountry,
    setProvince,
    setCity,
    setArea,
    countries,
    provinceOptions,
    cityOptions,
    areaOptions,
    matches: matchesLocation,
  } = locationFilter;
  const query = filters.query;
  const category = filters.category;
  const sortMode = filters.sortMode;
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);
  const [mergePreview, setMergePreview] = useState<PlaceMergePreview | null>(null);
  const [weakQueueIndex, setWeakQueueIndex] = useState<number | null>(null);
  const [batchShareMode, setBatchShareMode] = useState(false);
  const [selectedSharePlaceIds, setSelectedSharePlaceIds] = useState<string[]>([]);
  const [batchDraft, setBatchDraft] = useState<PlaceBatchDraft>({ category: "", mall: "", area: "", tags: "" });
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const strongDuplicateGroups = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "strong"),
    [duplicatePlaceGroups],
  );
  const weakDuplicateGroups = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "weak"),
    [duplicatePlaceGroups],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const isCustomSort = sortMode !== "smart";
  const activeAdvancedFilterCount = [country !== "全部", province !== "全部", city !== "全部", area !== "全部", category !== "全部", isCustomSort].filter(Boolean).length;
  const hasAdvancedFilters = activeAdvancedFilterCount > 0;
  const hasActiveFilters = Boolean(normalizedQuery || hasAdvancedFilters);
  const [filtersOpen, setFiltersOpen] = useState(hasAdvancedFilters);

  const categories = useMemo(() => {
    return ["全部", ...new Set(state.places.map((place) => place.category))];
  }, [state.places]);

  const places = useMemo(() => {
    return state.places.filter((place) => {
      if (importedPlaceIdSet.size && !importedPlaceIdSet.has(place.id)) return false;
      const inCategory = category === "全部" || place.category === category;
      const content = [
        place.name,
        place.mall,
        place.storeName,
        place.area,
        place.province,
        place.city,
        place.country,
        place.category,
        place.address,
        place.desc,
        place.tags.join(","),
      ].join(" ");
      return (
        matchesLocation(place) &&
        inCategory &&
        content.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, importedPlaceIdSet, matchesLocation, normalizedQuery, state.places]);

  const mallGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        mall: string;
        country: string;
        province: string;
        city: string;
        count: number;
        categories: Set<string>;
        storePlaceIds: string[];
        visitStats: MallVisitStats;
      }
    >();

    for (const place of places) {
      if (!getPlaceMallName(place)) continue;
      const key = buildMallKey(place);
      if (!key) continue;

      const current = groups.get(key) || {
        key,
        mall: getPlaceMallName(place),
        country: place.country,
        province: place.province,
        city: place.city,
        count: 0,
        categories: new Set<string>(),
        storePlaceIds: [],
        visitStats: buildMallVisitStats([], state.memories, getPersonName),
      };
      if (!isMallRecord(place)) {
        current.count += 1;
        current.categories.add(place.category);
        current.storePlaceIds.push(place.id);
      }
      current.visitStats = buildMallVisitStats(current.storePlaceIds, state.memories, getPersonName);
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.mall.localeCompare(b.mall, "zh-CN"),
    );
  }, [getPersonName, places, state.memories]);

  const placeRows = useMemo(() => {
    return places
      .map((place) => ({
        place,
        visitStats: buildPlaceVisitStats(place.id, state.memories, getPersonName)
      }))
      .sort((left, right) => comparePlaceRows(left, right, sortMode));
  }, [getPersonName, places, sortMode, state.memories]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除地点",
      message: "确认删除这个地点？相关回忆中的地点关联也会被清空。",
      confirmText: "删除",
    });
    if (!accepted) return;
    const snapshot = await getDeleteSnapshot("place", id);
    await deleteEntry("place", id);
    if (snapshot) {
      notify({
        message: "地点已删除",
        tone: "info",
        actions: [
          {
            label: "撤销",
            onClick: async () => {
              await restoreDeletedEntry(snapshot);
              notify({ message: "地点已恢复", tone: "success" });
            }
          }
        ]
      });
    }
  }

  function handleMergeGroup(group: PlaceDuplicateGroup) {
    const preview = buildGroupMergePreview(group, state.places);
    if (!preview) return;
    setMergePreview(preview);
    setWeakQueueIndex(null);
  }

  function openWeakQueue() {
    if (!weakDuplicateGroups.length) return;
    const preview = buildGroupMergePreview(weakDuplicateGroups[0], state.places);
    if (!preview) return;
    setMergePreview(preview);
    setWeakQueueIndex(0);
  }

  function stepWeakQueue(direction: "next" | "skip") {
    if (weakQueueIndex === null) return;
    const nextIndex = direction === "next" ? weakQueueIndex : weakQueueIndex + 1;
    if (nextIndex >= weakDuplicateGroups.length) {
      setMergePreview(null);
      setWeakQueueIndex(null);
      return;
    }

    const nextPreview = buildGroupMergePreview(weakDuplicateGroups[nextIndex], state.places);
    if (!nextPreview) {
      setMergePreview(null);
      setWeakQueueIndex(null);
      return;
    }

    setMergePreview(nextPreview);
    setWeakQueueIndex(nextIndex);
  }

  async function handleMergeAll() {
    if (!strongDuplicateGroups.length) return;

    const accepted = await confirm({
      title: "一键合并重复地点",
      message: `当前检测到 ${strongDuplicateGroups.length} 组强重复地点，会自动合并这些明确重复项。弱重复仍然保留手动确认。`,
      confirmText: "开始合并",
    });
    if (!accepted) return;
    await mergeAllDuplicatePlaces();
  }

  async function handleUndoLatestMerge() {
    if (!latestPlaceMerge) return;
    const accepted = await confirm({
      title: "撤销上一次合并",
      message: `将恢复 ${new Date(latestPlaceMerge.happenedAt).toLocaleString("zh-CN")} 的地点合并前状态。`,
      confirmText: "撤销",
    });
    if (!accepted) return;
    await undoLatestPlaceMerge();
    setMergePreview(null);
    setWeakQueueIndex(null);
  }

  function clearFilters() {
    const reset = {
      query: "",
      country: "全部",
      province: "全部",
      city: "全部",
      area: "全部",
      category: "全部",
      sortMode: "smart" as const
    };
    setFilters(reset);
    setCountry(reset.country);
    setProvince(reset.province);
    setCity(reset.city);
    setArea(reset.area);
    setFiltersOpen(false);
  }

  function clearImportedView() {
    const next = new URLSearchParams(searchParams);
    next.delete("imported");
    setSearchParams(next, { replace: true });
  }

  function updateFilters(patch: Partial<PlaceFilterState>) {
    setFilters({ ...filters, ...patch });
  }

  function updateCountry(value: string) {
    setCountry(value);
    updateFilters({ country: value, province: "全部", city: "全部", area: "全部" });
  }

  function updateProvince(value: string) {
    setProvince(value);
    updateFilters({ province: value, city: "全部", area: "全部" });
  }

  function updateCity(value: string) {
    setCity(value);
    updateFilters({ city: value, area: "全部" });
  }

  function updateArea(value: string) {
    setArea(value);
    updateFilters({ area: value });
  }

  function updateBatchDraft(patch: Partial<PlaceBatchDraft>) {
    setBatchDraft((current) => ({ ...current, ...patch }));
  }

  async function applyBatchUpdate() {
    const patch = buildPlaceBatchPatch(batchDraft);
    const result = await updatePlacesBulk(selectedSharePlaceIds, patch);
    if (!result.count) {
      notify({ message: "先填写要批量修改的字段", tone: "info" });
      return;
    }
    setBatchDraft({ category: "", mall: "", area: "", tags: "" });
    setBatchPreviewOpen(false);
    notify({
      message: `已更新 ${result.count} 个地点`,
      tone: "success",
      actions: [
        {
          label: "撤销",
          onClick: async () => {
            const restored = await restorePlacesBulk(result.before);
            notify({ message: restored ? `已恢复 ${restored} 个地点` : "没有可恢复的地点", tone: restored ? "success" : "info" });
          }
        }
      ]
    });
  }

  const storePlaceRows = placeRows.filter(({ place }) => !isMallRecord(place));
  const selectablePlaceIds = storePlaceRows.map(({ place }) => place.id);
  const selectedShareCount = selectedSharePlaceIds.length;
  const batchPreview = useMemo(
    () => buildPlaceBatchPreview(storePlaceRows.map(({ place }) => place), selectedSharePlaceIds, batchDraft),
    [batchDraft, selectedSharePlaceIds, storePlaceRows]
  );
  const currentSortLabel = placeSortOptions.find((option) => option.value === sortMode)?.label || "";
  const activeFilterLabels = [
    ...buildActiveFilterLabels({
      query: query.trim(),
      country,
      province,
      city,
      area,
      category
    }),
    isCustomSort ? `排序：${currentSortLabel}` : ""
  ].filter(Boolean);

  return (
    <>
      <PageSegmentNav
        ariaLabel="档案视图"
        items={[
          { to: "/people", label: "人物", icon: <Users />, end: true },
          { to: "/places", label: "地点", icon: <MapPin /> }
        ]}
      />
      <SearchBar
        value={query}
        placeholder="搜索地点、区域、城市、标签"
        onChange={(query) => updateFilters({ query })}
      />
      {importedPlaceIds.length > 0 && (
        <section className="section imported-focus-section">
          <GlassCard className="imported-focus-card">
            <div>
              <strong>刚导入的地点</strong>
              <span>已临时筛出 {places.length} 个刚添加的地点，便于检查和补充信息。</span>
            </div>
            <button className="mini-action" type="button" onClick={clearImportedView}>
              查看全部
            </button>
          </GlassCard>
        </section>
      )}
      <section className="section list-filter-section compact-filter-section">
        <div className="list-filter-toolbar">
          <div className="list-filter-summary">
            <span>
              显示 {places.length} / {state.places.length} 个地点
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
          <div className="advanced-filter-panel place-advanced-filter-panel">
            <div className="location-switcher">
              <label>
                国家
                <SelectPicker
                  label="国家筛选"
                  value={country}
                  onChange={updateCountry}
                  options={countries.map((item) => ({ value: item, label: item }))}
                />
              </label>
              <label>
                省 / 州
                <SelectPicker
                  label="省州筛选"
                  value={province}
                  onChange={updateProvince}
                  options={provinceOptions.map((item) => ({ value: item, label: item }))}
                />
              </label>
              <label>
                城市
                <SelectPicker
                  label="城市筛选"
                  value={city}
                  onChange={updateCity}
                  options={cityOptions.map((item) => ({ value: item, label: item }))}
                />
              </label>
            </div>
            <div className="filter-subgroup">
              <strong>区域</strong>
              <div className="category-row">
                {areaOptions.map((item) => (
                  <button
                    className={`category-pill ${item === area ? "active" : ""}`}
                    key={item}
                    onClick={() => updateArea(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-subgroup">
              <strong>分类</strong>
              <div className="category-row">
                {categories.map((item) => (
                  <button
                    className={`category-pill ${item === category ? "active" : ""}`}
                    key={item}
                    onClick={() => updateFilters({ category: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-subgroup">
              <strong>排序</strong>
              <div className="list-sort-control" role="group" aria-label="地点排序">
                {placeSortOptions.map((option) => (
                  <button
                    type="button"
                    className={option.value === sortMode ? "active" : ""}
                    key={option.value}
                    onClick={() => updateFilters({ sortMode: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      {duplicatePlaceGroups.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <GitMerge /> 疑似重复地点
            </h2>
            {strongDuplicateGroups.length > 0 && (
              <button className="see-all" onClick={() => void handleMergeAll()}>
                一键合并
              </button>
            )}
          </div>
          <div className="duplicate-summary-grid">
            <GlassCard className="duplicate-summary-card strong">
              <strong>{strongDuplicateGroups.length}</strong>
              <span>强重复，可批量合并</span>
            </GlassCard>
            <GlassCard className="duplicate-summary-card weak">
              <strong>{weakDuplicateGroups.length}</strong>
              <span>疑似重复，建议人工确认</span>
            </GlassCard>
          </div>
          {placeMergeHistory.length > 0 && (
            <div className="list">
              {placeMergeHistory.map((entry, index) => (
                <GlassCard className="detail-row" key={entry.id}>
                  <div className="merge-info">
                    <strong>{index === 0 ? "最近一次合并" : `更早一次合并 ${index}`}</strong>
                    <span>
                      {new Date(entry.happenedAt).toLocaleString("zh-CN")} · {entry.reason} ·{" "}
                      {entry.placeIds.length} 条记录
                    </span>
                  </div>
                  {index === 0 ? (
                    <button className="mini-action add" onClick={() => void handleUndoLatestMerge()}>
                      撤销
                    </button>
                  ) : (
                    <span className="merge-history-badge">已归档</span>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
          <DuplicateGroupList
            groups={strongDuplicateGroups}
            title="强重复"
            emptyText="暂无强重复地点"
            onPreview={handleMergeGroup}
          />
          <DuplicateGroupList
            groups={weakDuplicateGroups}
            title="待确认"
            emptyText="暂无待确认重复地点"
            action={
              weakDuplicateGroups.length > 0 ? (
                <button className="mini-action add" onClick={openWeakQueue} type="button">
                  逐条处理
                </button>
              ) : null
            }
            onPreview={handleMergeGroup}
          />
        </section>
      )}
      {mallGroups.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Building2 /> 商场 / 园区
            </h2>
            <button className="see-all" onClick={() => setCreatingNew(true)}>
              新建
            </button>
          </div>
          <div className="list">
            {mallGroups.map((mall) => (
              <button
                className="mall-list-card detail-button glass-card"
                key={mall.key}
                onClick={() =>
                  navigate(`/places/malls/${encodeURIComponent(mall.key)}`)
                }
              >
                <span className="mall-list-main">
                  <span className="mall-list-icon">
                    <Building2 size={18} />
                  </span>
                  <span className="mall-list-copy">
                    <strong>{mall.mall}</strong>
                    <small>{[mall.province, mall.city].filter(Boolean).join(" · ") || "未设置城市"}</small>
                  </span>
                </span>
                <div className="place-visit-line mall-visit-line">
                  <span>{mall.visitStats.storeCount} 家店</span>
                  <span>{mall.visitStats.visitCount ? `总到访 ${mall.visitStats.visitCount} 次` : "还没有到访"}</span>
                  <span>{mall.visitStats.latestLabel}</span>
                  {mall.visitStats.topPeople.length > 0 && <span>常一起：{mall.visitStats.topPeople.map((item) => item.label).join("、")}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-header">
          <h2>
            <Store /> 具体店铺 / 场所
          </h2>
          <div className="section-header-actions">
            {storePlaceRows.length > 0 && (
              <button
                className="see-all"
                onClick={() => {
                  setBatchShareMode((current) => !current);
                  setSelectedSharePlaceIds([]);
                  setBatchDraft({ category: "", mall: "", area: "", tags: "" });
                }}
              >
                {batchShareMode ? "取消" : "批量 / 分享"}
              </button>
            )}
            {!mallGroups.length && (
              <button className="see-all" onClick={() => setCreatingNew(true)}>
                新建商场
              </button>
            )}
          </div>
        </div>
        {batchShareMode && (
          <GlassCard className="batch-share-toolbar">
            <div>
              <strong>已选择 {selectedShareCount} 个地点</strong>
              <span>可批量分享，也可以统一补充分类、商场、区域或标签。</span>
            </div>
            <div>
              <button
                className="mini-action"
                type="button"
                onClick={() => setSelectedSharePlaceIds(selectedShareCount === selectablePlaceIds.length ? [] : selectablePlaceIds)}
              >
                {selectedShareCount === selectablePlaceIds.length ? <Square size={14} /> : <CheckSquare size={14} />}
                {selectedShareCount === selectablePlaceIds.length ? "取消全选" : "全选"}
              </button>
              <button
                className="mini-action add"
                type="button"
                disabled={!selectedShareCount}
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={14} />
                分享
              </button>
              <button
                className="mini-action"
                type="button"
                onClick={() => {
                  setBatchShareMode(false);
                  setSelectedSharePlaceIds([]);
                  setBatchDraft({ category: "", mall: "", area: "", tags: "" });
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="batch-edit-grid">
              <label>
                分类
                <input
                  value={batchDraft.category}
                  placeholder="如 餐厅"
                  onChange={(event) => updateBatchDraft({ category: event.target.value })}
                />
              </label>
              <label>
                商场
                <input
                  value={batchDraft.mall}
                  placeholder="如 万象城"
                  onChange={(event) => updateBatchDraft({ mall: event.target.value })}
                />
              </label>
              <label>
                区域
                <input
                  value={batchDraft.area}
                  placeholder="如 西湖区"
                  onChange={(event) => updateBatchDraft({ area: event.target.value })}
                />
              </label>
              <label>
                追加标签
                <input
                  value={batchDraft.tags}
                  placeholder="用空格或逗号分隔"
                  onChange={(event) => updateBatchDraft({ tags: event.target.value })}
                />
              </label>
              <button
                className="mini-action add"
                type="button"
                disabled={!selectedShareCount}
                onClick={() => setBatchPreviewOpen(true)}
              >
                预览修改
              </button>
            </div>
            {batchPreviewOpen && (
              <div className="batch-preview-panel">
                <div>
                  <strong>将更新 {batchPreview.count} 个地点</strong>
                  <span>{batchPreview.summary || "还没有填写要修改的字段"}</span>
                </div>
                {batchPreview.examples.length > 0 && (
                  <ul>
                    {batchPreview.examples.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <div>
                  <button className="mini-action" type="button" onClick={() => setBatchPreviewOpen(false)}>
                    取消
                  </button>
                  <button
                    className="mini-action add"
                    type="button"
                    disabled={!batchPreview.count || !batchPreview.summary}
                    onClick={() => void applyBatchUpdate()}
                  >
                    确认应用
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        )}
        <div className="list">
          {storePlaceRows.map(({ place, visitStats }) => {
            const selected = selectedSharePlaceIds.includes(place.id);
            return (
              <GlassCard className={`place-card ${batchShareMode ? "selectable" : ""} ${selected ? "selected" : ""}`} key={place.id}>
                {batchShareMode && (
                  <button
                    className="place-share-select"
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? "取消选择地点" : "选择地点"}
                    onClick={() => toggleSharePlace(place.id, setSelectedSharePlaceIds)}
                  >
                    {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                )}
                <button
                  className="place-tap"
                  onClick={() => {
                    if (batchShareMode) {
                      toggleSharePlace(place.id, setSelectedSharePlaceIds);
                      return;
                    }
                    navigate(`/places/${place.id}`);
                  }}
                >
                  <div className="place-img">
                    <MapPin />
                  </div>
                </button>
                <div
                  className="place-info"
                  onClick={() => {
                    if (batchShareMode) {
                      toggleSharePlace(place.id, setSelectedSharePlaceIds);
                      return;
                    }
                    navigate(`/places/${place.id}`);
                  }}
                >
                  <div className="place-name">
                    <span>{buildPlaceDisplayName(place)}</span>
                    <span className="place-title-actions">
                      <NotionSyncBadge
                        compact
                        meta={getNotionRecordSyncMeta({
                          enabled: Boolean(notionSettings.enabled && notionSettings.placesDatabaseId),
                          entityType: "place",
                          entityId: place.id,
                          mappings: notionPageMappings,
                          queue: notionSyncQueue
                        })}
                      />
                      <button
                        type="button"
                        className={`favorite-toggle ${place.favorite ? "active" : ""}`}
                        aria-pressed={place.favorite}
                        aria-label={place.favorite ? "取消收藏" : "收藏"}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (batchShareMode) return;
                          void togglePlaceFavorite(place.id);
                        }}
                      >
                        <Star size={18} fill={place.favorite ? "currentColor" : "none"} />
                      </button>
                      <span className="place-rating">
                        <Star /> {place.rating ? place.rating : "未评分"}
                      </span>
                    </span>
                  </div>
                  <p className="place-desc truncate-text">
                    {buildPlaceGeoLine(place)}
                  </p>
                  <p className="place-desc truncate-text">
                    {place.category} · {buildPlaceContextLine(place)}
                  </p>
                  <div className="place-visit-line">
                    <span>{visitStats.visitCount ? `去过 ${visitStats.visitCount} 次` : "还没有到访"}</span>
                    <span>{visitStats.latestLabel}</span>
                    {visitStats.topPeople.length > 0 && <span>常一起：{visitStats.topPeople.map((item) => item.label).join("、")}</span>}
                  </div>
                  <p className="place-desc truncate-lines-2">
                    {place.address || place.desc}
                  </p>
                  <Tags items={place.tags} />
                </div>
                <div className="person-side-actions">
                  {batchShareMode ? (
                    <button
                      className="icon-action"
                      type="button"
                      aria-label={selected ? "取消选择地点" : "选择地点"}
                      onClick={() => toggleSharePlace(place.id, setSelectedSharePlaceIds)}
                    >
                      {selected ? <CheckSquare /> : <Square />}
                    </button>
                  ) : (
                    <CardActions
                      onEdit={() => setEditingId(place.id)}
                      onDelete={() => handleDelete(place.id)}
                    />
                  )}
                </div>
              </GlassCard>
            );
          })}
          {!places.length &&
            (state.places.length === 0 ? (
              <GlassCard className="empty empty-cta">
                <p>还没有地点记录</p>
                <button className="primary-btn" onClick={() => setCreatingNew(true)}>
                  <Plus size={16} /> 新增第一个地点
                </button>
              </GlassCard>
            ) : (
              <GlassCard className="empty empty-cta">
                <p>没有找到匹配的地点</p>
                <button className="primary-btn" onClick={clearFilters}>
                  <RotateCcw size={16} /> 清除筛选
                </button>
              </GlassCard>
            ))}
        </div>
      </section>
      <EntrySheet
        type={editingId ? "place" : null}
        itemId={editingId}
        onClose={() => setEditingId(undefined)}
      />
      <EntrySheet
        type={creatingNew ? "place" : null}
        onClose={() => setCreatingNew(false)}
      />
      {mergePreview && (
        <MergePreviewDialog
          preview={mergePreview}
          onClose={() => setMergePreview(null)}
          queueState={
            weakQueueIndex === null
              ? null
              : {
                  index: weakQueueIndex + 1,
                  total: weakDuplicateGroups.length,
                }
          }
          onSkip={
            weakQueueIndex === null
              ? undefined
              : () => {
                  stepWeakQueue("skip");
                }
          }
          onMerge={async (nextPreview) => {
            await mergePlacePreview(nextPreview);
            if (weakQueueIndex === null) {
              setMergePreview(null);
              return;
            }
            stepWeakQueue("next");
          }}
        />
      )}
      <LocalShareSheet
        target={
          shareOpen
            ? {
                type: "places",
                placeIds: selectedSharePlaceIds,
                title: `批量分享 ${selectedSharePlaceIds.length} 个地点`,
                count: selectedSharePlaceIds.length
              }
            : null
        }
        onClose={() => {
          setShareOpen(false);
          setBatchShareMode(false);
          setSelectedSharePlaceIds([]);
        }}
      />
    </>
  );
}

const placeSortOptions: Array<{ value: PlaceSortMode; label: string }> = [
  { value: "smart", label: "智能" },
  { value: "recent", label: "最近" },
  { value: "rating", label: "评分" },
  { value: "name", label: "名称" }
];

function isPlaceFilterState(value: unknown): value is PlaceFilterState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlaceFilterState>;
  return (
    typeof candidate.query === "string" &&
    typeof candidate.country === "string" &&
    typeof candidate.province === "string" &&
    typeof candidate.city === "string" &&
    typeof candidate.area === "string" &&
    typeof candidate.category === "string" &&
    ["smart", "recent", "rating", "name"].includes(String(candidate.sortMode))
  );
}

function toggleSharePlace(placeId: string, setSelected: (updater: (current: string[]) => string[]) => void) {
  setSelected((current) => (
    current.includes(placeId)
      ? current.filter((id) => id !== placeId)
      : [...current, placeId]
  ));
}

function splitBatchTags(value: string) {
  return value
    .split(/[\s,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPlaceBatchPatch(draft: PlaceBatchDraft) {
  return {
    category: draft.category,
    mall: draft.mall,
    area: draft.area,
    appendTags: splitBatchTags(draft.tags)
  };
}

function buildPlaceBatchPreview(places: Place[], selectedIds: string[], draft: PlaceBatchDraft) {
  const selected = new Set(selectedIds);
  const targetPlaces = places.filter((place) => selected.has(place.id));
  const patch = buildPlaceBatchPatch(draft);
  const changes = [
    patch.category.trim() ? `分类改为「${patch.category.trim()}」` : "",
    patch.mall.trim() ? `商场改为「${patch.mall.trim()}」` : "",
    patch.area.trim() ? `区域改为「${patch.area.trim()}」` : "",
    patch.appendTags.length ? `追加标签「${patch.appendTags.join("、")}」` : ""
  ].filter(Boolean);

  return {
    count: targetPlaces.length,
    summary: changes.join(" · "),
    examples: targetPlaces.slice(0, 3).map((place) => buildPlaceDisplayName(place))
  };
}

function comparePlaceRows(
  left: { place: Place; visitStats: PlaceVisitStats },
  right: { place: Place; visitStats: PlaceVisitStats },
  mode: PlaceSortMode
) {
  if (mode === "name") return comparePlaceName(left.place, right.place);

  if (mode === "recent") {
    return (
      compareDateDesc(left.visitStats.latestDate, right.visitStats.latestDate) ||
      compareFavorite(left.place.favorite, right.place.favorite) ||
      comparePlaceName(left.place, right.place)
    );
  }

  if (mode === "rating") {
    return (
      compareRatingDesc(left.place.rating, right.place.rating) ||
      compareFavorite(left.place.favorite, right.place.favorite) ||
      compareDateDesc(left.visitStats.latestDate, right.visitStats.latestDate) ||
      comparePlaceName(left.place, right.place)
    );
  }

  return (
    compareFavorite(left.place.favorite, right.place.favorite) ||
    compareDateDesc(left.visitStats.latestDate, right.visitStats.latestDate) ||
    compareRatingDesc(left.place.rating, right.place.rating) ||
    right.visitStats.visitCount - left.visitStats.visitCount ||
    comparePlaceName(left.place, right.place)
  );
}

function compareFavorite(left: boolean, right: boolean) {
  return Number(right) - Number(left);
}

function compareDateDesc(left: string, right: string) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

function compareRatingDesc(left: number, right: number) {
  const normalizedLeft = left || 0;
  const normalizedRight = right || 0;
  return normalizedRight - normalizedLeft;
}

function comparePlaceName(left: Place, right: Place) {
  return buildPlaceDisplayName(left).localeCompare(buildPlaceDisplayName(right), "zh-CN");
}

function buildActiveFilterLabels(filters: {
  query: string;
  country: string;
  province: string;
  city: string;
  area: string;
  category: string;
}) {
  return [
    filters.query ? `搜索：${filters.query}` : "",
    filters.country !== "全部" ? `国家：${filters.country}` : "",
    filters.province !== "全部" ? `省州：${filters.province}` : "",
    filters.city !== "全部" ? `城市：${filters.city}` : "",
    filters.area !== "全部" ? `区域：${filters.area}` : "",
    filters.category !== "全部" ? `分类：${filters.category}` : ""
  ].filter(Boolean);
}

function parseImportedIds(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function DuplicateGroupList({
  groups,
  title,
  emptyText,
  action,
  onPreview
}: {
  groups: PlaceDuplicateGroup[];
  title: string;
  emptyText: string;
  action?: ReactNode;
  onPreview: (group: PlaceDuplicateGroup) => void;
}) {
  return (
    <div className="duplicate-group-section">
      <div className="duplicate-group-head">
        <strong>{title}</strong>
        {action}
      </div>
      {groups.length ? (
        <div className="list">
          {groups.map((group) => (
            <GlassCard className="detail-row" key={group.signature}>
              <div className="merge-info">
                <strong>{group.label}</strong>
                <span>
                  {group.reason} · {group.placeIds.length} 条记录 · {group.strength === "strong" ? "强重复" : "待确认"}
                </span>
              </div>
              <button className="mini-action add" onClick={() => onPreview(group)} type="button">
                预览
              </button>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="empty">{emptyText}</GlassCard>
      )}
    </div>
  );
}

function MergePreviewDialog({
  preview,
  onClose,
  queueState,
  onSkip,
  onMerge,
}: {
  preview: PlaceMergePreview;
  onClose: () => void;
  queueState?: { index: number; total: number } | null;
  onSkip?: () => void;
  onMerge: (preview: PlaceMergePreview) => void;
}) {
  return (
    <div className="confirm-layer">
      <div className="confirm-backdrop" onClick={onClose} />
      <section className="confirm-dialog merge-dialog">
        {queueState && (
          <p className="form-hint">弱重复处理进度：{queueState.index} / {queueState.total}</p>
        )}
        <PlaceMergeWorkbench
          preview={preview}
          title="地点合并预览"
          confirmLabel="确认合并"
          cancelLabel="关闭"
          allowKeepBoth={Boolean(onSkip)}
          keepBothLabel="跳过这组"
          onCancel={onClose}
          onKeepBoth={onSkip}
          onConfirm={onMerge}
        />
      </section>
    </div>
  );
}
