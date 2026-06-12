import { ArrowLeft, Building2, Edit3, MapPin, Navigation, PlusCircle, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import type { Place } from "../../types";
import {
  buildPlaceContextLine,
  buildPlaceDisplayName,
  buildPlaceGeoLine,
  isMallRecord,
  isSameMall,
  parseMallKey,
} from "../../utils/placeMeta";
import { buildMemoryDisplayContext, isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { openExternalUrl, openPlaceMap } from "../../utils/externalLinks";
import { buildMallVisitStats, buildPlaceVisitStats } from "../../utils/placeVisitStats";

export default function MallDetail() {
  const navigate = useNavigate();
  const { mallKey } = useParams();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingMallRecord, setCreatingMallRecord] = useState(false);

  const mallInfo = useMemo(() => parseMallKey(mallKey || ""), [mallKey]);
  const places = useMemo(
    () =>
      state.places
        .filter((place) => isSameMall(place, mallInfo))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [mallInfo, state.places],
  );

  const summary = places[0];
  const mallRecord = places.find((place) => isMallRecord(place));
  const storePlaces = places.filter((place) => !isMallRecord(place));
  const categories = Array.from(new Set(places.filter((p) => !isMallRecord(p)).map((place) => place.category)));
  const relatedEntries = state.memories
    .filter((memory) =>
      getMemoryPlaceIds(memory).some((placeId) => places.some((place) => place.id === placeId)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const relatedPlans = relatedEntries.filter(isMemoryPlan);
  const mallVisitStats = buildMallVisitStats(storePlaces.map((place) => place.id), state.memories, getPersonName);
  const storeVisitStats = new Map(
    storePlaces.map((place) => [place.id, buildPlaceVisitStats(place.id, state.memories, getPersonName)])
  );
  const displayAddress = mallRecord?.address || summary?.address || "";
  const initialMallDraft = useMemo<Partial<Place> | undefined>(() => {
    if (!summary) return undefined;
    return {
      name: mallInfo.mall,
      country: mallInfo.country,
      province: mallInfo.province,
      city: mallInfo.city,
      area: summary.area,
      mall: mallInfo.mall,
      category: "商场",
      address: summary.address,
      mapUrl: summary.mapUrl,
      latitude: summary.latitude,
      longitude: summary.longitude,
      desc: `${mallInfo.mall} 的商场资料`,
      tags: ["商场"]
    };
  }, [mallInfo, summary]);

  if (!summary) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个商场</GlassCard>
      </section>
    );
  }

  return (
    <>
      <section className={`section detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card">
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/places")}>
              <ArrowLeft /> 返回地点
            </button>
            <strong className="detail-compact-title">{mallInfo.mall || summary.mall}</strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">
              <Building2 />
            </div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>{mallInfo.mall || summary.mall}</h2>
              </div>
              <p>{buildPlaceGeoLine(summary)}</p>
              <p>{summary.area || "未设置区位"}</p>
              {displayAddress && (
                <p className="mall-address">
                  <Navigation size={14} style={{ flexShrink: 0 }} />
                  <span>{displayAddress}</span>
                </p>
              )}
              <Tags items={categories} />
            </div>
          </div>
        </GlassCard>
        <button
          className="mall-profile-action glass-card"
          type="button"
          onClick={() => (mallRecord ? setEditingId(mallRecord.id) : setCreatingMallRecord(true))}
        >
          {mallRecord ? <Edit3 /> : <PlusCircle />}
          <span>{mallRecord ? "编辑商场资料" : "补充商场资料"}</span>
        </button>
      </section>

      {displayAddress && (
        <section className="section mall-nav-section">
          <button
            className="mall-nav-button glass-card"
            type="button"
            onClick={() => {
              const source = mallRecord || summary;
              if (source.latitude && source.longitude) {
                void openPlaceMap(source);
              } else {
                void openExternalUrl(`https://uri.amap.com/search?keyword=${encodeURIComponent(displayAddress || mallInfo.mall)}`);
              }
            }}
          >
            <Navigation size={18} />
            <div className="mall-nav-info">
              <strong>导航到 {mallInfo.mall}</strong>
              <span>{displayAddress}</span>
            </div>
          </button>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 到访摘要
          </h2>
        </div>
        <GlassCard className="detail-summary-card">
          <div className="summary-grid">
            <div className="summary-metric">
              <strong>{mallVisitStats.storeCount}</strong>
              <span>里面的地点</span>
            </div>
            <div className="summary-metric">
              <strong>{mallVisitStats.visitCount}</strong>
              <span>总到访</span>
            </div>
          </div>
          <div className="summary-line">
            <strong>最近到访</strong>
            <span>{mallVisitStats.latestDate ? mallVisitStats.latestLabel : "还没有到访记录"}</span>
          </div>
          {relatedPlans.length > 0 && (
            <div className="summary-line">
              <strong>计划</strong>
              <span>{relatedPlans.length} 条待发生记录</span>
            </div>
          )}
          <div className="summary-line">
            <strong>常关联人物</strong>
            <span>{mallVisitStats.topPeople.length ? mallVisitStats.topPeople.map((item) => item.label).join("、") : "还没有关联人物"}</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Store /> 里面的地点
          </h2>
        </div>
        <div className="list">
          {storePlaces
            .map((place) => {
              const visitStats = storeVisitStats.get(place.id);
              return (
              <button
                className="vertical-detail-card detail-button glass-card"
                key={place.id}
                onClick={() => navigate(`/places/${place.id}`)}
              >
                <strong className="truncate-text" style={{ width: "100%" }}>
                  {buildPlaceDisplayName(place)}
                </strong>
                <span className="truncate-lines-2">
                  {[place.category, buildPlaceContextLine(place), place.address]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {visitStats && (
                  <span className="place-visit-line mall-store-visit-line">
                    <span>{visitStats.visitCount ? `去过 ${visitStats.visitCount} 次` : "还没有到访"}</span>
                    <span>{visitStats.latestLabel}</span>
                    {visitStats.topPeople.length > 0 && <span>常一起：{visitStats.topPeople.map((item) => item.label).join("、")}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 相关记录
          </h2>
        </div>
        <div className="list">
          {relatedEntries
            .slice(0, 8)
            .map((memory) => {
              const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
              return (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  ctx={ctx}
                  icon="♡"
                  onOpen={() => navigate(`/memories/${memory.id}`)}
                />
              );
            })}
        </div>
      </section>
      <EntrySheet type={editingId ? "place" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
      <EntrySheet
        type={creatingMallRecord ? "place" : null}
        initialPlaceDraft={initialMallDraft}
        onClose={() => setCreatingMallRecord(false)}
      />
    </>
  );
}
