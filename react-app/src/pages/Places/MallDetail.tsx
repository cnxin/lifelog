import { ArrowLeft, Building2, Edit3, MapPin, Navigation, PlusCircle, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
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
import { buildMemoryDisplayContext, getMemoryDisplayTitle } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";

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
  const categories = Array.from(new Set(places.filter((p) => !isMallRecord(p)).map((place) => place.category)));
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
                window.open(`https://uri.amap.com/marker?position=${source.longitude},${source.latitude}&name=${encodeURIComponent(mallInfo.mall)}`, "_blank");
              } else {
                window.open(`https://uri.amap.com/search?keyword=${encodeURIComponent(displayAddress || mallInfo.mall)}`, "_blank");
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
            <Store /> 里面的地点
          </h2>
        </div>
        <div className="list">
          {places
            .filter((place) => !isMallRecord(place))
            .map((place) => (
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
              </button>
            ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 关联回忆
          </h2>
        </div>
        <div className="list">
            {state.memories
              .filter((memory) =>
                getMemoryPlaceIds(memory).some((placeId) => places.some((place) => place.id === placeId)),
              )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 8)
            .map((memory) => {
              const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
              return (
                <button
                  className="vertical-detail-card detail-button glass-card"
                  key={memory.id}
                  onClick={() => navigate(`/memories/${memory.id}`)}
                >
                  <strong className="truncate-text" style={{ width: "100%" }}>
                    {getMemoryDisplayTitle(memory, ctx)}
                  </strong>
                  <span className="truncate-lines-2">
                    {memory.content || "查看回忆详情"}
                  </span>
                </button>
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
