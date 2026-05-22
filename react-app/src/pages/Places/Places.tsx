import { Building2, GitMerge, MapPin, Plus, Star, Store } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import PlaceMergeWorkbench from "../../components/PlaceMergeWorkbench";
import SearchBar from "../../components/SearchBar";
import SelectPicker from "../../components/SelectPicker";
import Tags from "../../components/Tags";
import type { PlaceDuplicateGroup, PlaceMergePreview } from "../../types";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { usePlaceLocationFilter } from "../../hooks/usePlaceLocationFilter";
import { buildGroupMergePreview } from "../../utils/placeDedup";
import {
  buildMallKey,
  buildPlaceContextLine,
  buildPlaceDisplayName,
  buildPlaceGeoLine,
  getPlaceMallName,
  isMallRecord,
} from "../../utils/placeMeta";

export default function Places() {
  const {
    state,
    deleteEntry,
    duplicatePlaceGroups,
    placeMergeHistory,
    latestPlaceMerge,
    mergePlacePreview,
    mergeDuplicatePlaces,
    mergeAllDuplicatePlaces,
    undoLatestPlaceMerge,
    togglePlaceFavorite,
  } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const locationFilter = usePlaceLocationFilter(state.places);
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
  const [category, setCategory] = useState("全部");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);
  const [mergePreview, setMergePreview] = useState<PlaceMergePreview | null>(null);
  const [weakQueueIndex, setWeakQueueIndex] = useState<number | null>(null);
  const strongDuplicateGroups = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "strong"),
    [duplicatePlaceGroups],
  );
  const weakDuplicateGroups = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "weak"),
    [duplicatePlaceGroups],
  );

  const categories = useMemo(() => {
    return ["全部", ...new Set(state.places.map((place) => place.category))];
  }, [state.places]);

  const places = useMemo(() => {
    return state.places.filter((place) => {
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
        content.toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [category, matchesLocation, query, state.places]);

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
      };
      if (!isMallRecord(place)) {
        current.count += 1;
        current.categories.add(place.category);
      }
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.mall.localeCompare(b.mall, "zh-CN"),
    );
  }, [places]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除地点",
      message: "确认删除这个地点？相关回忆中的地点关联也会被清空。",
      confirmText: "删除",
    });
    if (!accepted) return;
    await deleteEntry("place", id);
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

  const storePlaces = places.filter((place) => !isMallRecord(place) && !getPlaceMallName(place));

  return (
    <>
      <SearchBar
        value={query}
        placeholder="搜索地点、区域、城市、标签"
        onChange={setQuery}
      />
      <div className="location-switcher">
        <label>
          国家
          <SelectPicker
            label="国家筛选"
            value={country}
            onChange={setCountry}
            options={countries.map((item) => ({ value: item, label: item }))}
          />
        </label>
        <label>
          省 / 州
          <SelectPicker
            label="省州筛选"
            value={province}
            onChange={setProvince}
            options={provinceOptions.map((item) => ({ value: item, label: item }))}
          />
        </label>
        <label>
          城市
          <SelectPicker
            label="城市筛选"
            value={city}
            onChange={setCity}
            options={cityOptions.map((item) => ({ value: item, label: item }))}
          />
        </label>
      </div>
      <div className="category-row">
        {areaOptions.map((item) => (
          <button
            className={`category-pill ${item === area ? "active" : ""}`}
            key={item}
            onClick={() => setArea(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="category-row">
        {categories.map((item) => (
          <button
            className={`category-pill ${item === category ? "active" : ""}`}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
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
                className="detail-row detail-button glass-card"
                key={mall.key}
                onClick={() =>
                  navigate(`/places/malls/${encodeURIComponent(mall.key)}`)
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Building2 size={18} />
                  </div>
                  <strong className="truncate-text">{mall.mall}</strong>
                </div>
                <span>
                  {[mall.province, mall.city].filter(Boolean).join(" · ")}
                  {mall.count > 0 && ` · ${mall.count} 家店`}
                </span>
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
          {!mallGroups.length && (
            <button className="see-all" onClick={() => setCreatingNew(true)}>
              新建商场
            </button>
          )}
        </div>
        <div className="list">
          {storePlaces.map((place) => (
            <GlassCard className="place-card" key={place.id}>
              <button
                className="place-tap"
                onClick={() => navigate(`/places/${place.id}`)}
              >
                <div className="place-img">
                  <MapPin />
                </div>
              </button>
              <div
                className="place-info"
                onClick={() => navigate(`/places/${place.id}`)}
              >
                <div className="place-name">
                  <span>{buildPlaceDisplayName(place)}</span>
                  <span className="place-title-actions">
                    <button
                      type="button"
                      className={`favorite-toggle ${place.favorite ? "active" : ""}`}
                      aria-pressed={place.favorite}
                      aria-label={place.favorite ? "取消收藏" : "收藏"}
                      onClick={(event) => {
                        event.stopPropagation();
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
                <p className="place-desc truncate-lines-2">
                  {place.address || place.desc}
                </p>
                <Tags items={place.tags} />
              </div>
              <div className="person-side-actions">
                <CardActions
                  onEdit={() => setEditingId(place.id)}
                  onDelete={() => handleDelete(place.id)}
                />
              </div>
            </GlassCard>
          ))}
          {!places.length &&
            (state.places.length === 0 ? (
              <GlassCard className="empty empty-cta">
                <p>还没有地点记录</p>
                <button className="primary-btn" onClick={() => setCreatingNew(true)}>
                  <Plus size={16} /> 新增第一个地点
                </button>
              </GlassCard>
            ) : (
              <GlassCard className="empty">没有找到匹配的地点</GlassCard>
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
    </>
  );
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
