import { ArrowLeft, Camera, ExternalLink, MapPin, Navigation, Star, Store, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CompletionTipsSection, { type CompletionTip } from "../../components/CompletionTipsSection";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { formatMonthDay } from "../../utils/date";
import { groupMemoriesByMonth, getTopRelatedItems } from "../../utils/detailHelpers";
import { openExternalUrl, openNativeStoreUrl, openPlaceMap } from "../../utils/externalLinks";
import { hasMemoryPlace } from "../../utils/memoryPlaces";
import { normalizePlacePlatformLinks } from "../../utils/placeLinks";
import {
  buildMallKey,
  buildPlaceContextLine,
  buildPlaceDisplayName,
  buildPlaceGeoLine,
  getPlaceReferenceUrl
} from "../../utils/placeMeta";

export default function PlaceDetail() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const place = state.places.find((item) => item.id === placeId);

  if (!place) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个地点</GlassCard>
      </section>
    );
  }

  const relatedMemories = state.memories
    .filter((memory) => hasMemoryPlace(memory, place.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const relatedPeople = Array.from(
    new Set(relatedMemories.flatMap((memory) => memory.personIds || []).filter(Boolean))
  );
  const topPeople = getTopRelatedItems(
    relatedMemories.flatMap((memory) => memory.personIds || []).filter(Boolean),
    getPersonName
  );
  const groupedMemories = groupMemoriesByMonth(relatedMemories);
  const latestMemory = relatedMemories[0];
  const photos = (place.photos || []).slice(0, 3);
  const platformLinks = normalizePlacePlatformLinks(place.platformLinks);
  const referenceUrl = getPlaceReferenceUrl(place);
  const completionTips: CompletionTip[] = [
    {
      id: "mapLink",
      icon: <MapPin />,
      title: "补充高德入口",
      desc: "保存高德分享链接后可以直接打开高德。",
      visible: !place.mapUrl && !(place.latitude && place.longitude)
    },
    {
      id: "photos",
      icon: <Camera />,
      title: "补充照片",
      desc: "上传本地图片或添加图片链接后，详情页会展示前三张照片。",
      visible: !place.photos.length
    },
    {
      id: "address",
      icon: <Navigation />,
      title: "补充地址",
      desc: "地址和商场层级能让地点列表更好搜索。",
      visible: !place.address || !place.mall
    }
  ];

  return (
    <>
      <section className={`section detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card">
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/places")}>
              <ArrowLeft /> 返回地点
            </button>
            <strong className="detail-compact-title">{buildPlaceDisplayName(place)}</strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">
              <MapPin />
            </div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>
                  {buildPlaceDisplayName(place)}
                </h2>
                {place.favorite && <Star />}
              </div>
              <p>{buildPlaceGeoLine(place)}</p>
              <p>{buildPlaceContextLine(place)}</p>
              <button className="category-pill active" onClick={() => setEditing(true)}>
                编辑地点
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 到访摘要
          </h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            记录
          </button>
        </div>
        <GlassCard className="detail-summary-card">
          <div className="summary-grid">
            <div className="summary-metric">
              <strong>{relatedMemories.length}</strong>
              <span>相关回忆</span>
            </div>
            <div className="summary-metric">
              <strong>{latestMemory ? formatMonthDay(latestMemory.date) : "暂无"}</strong>
              <span>最近一次</span>
            </div>
          </div>
          <div className="summary-line">
            <strong>类型</strong>
            <span>{place.category || "未设置"}</span>
          </div>
          <div className="summary-line">
            <strong>常关联人物</strong>
            <span>{topPeople.length ? topPeople.map((item) => item.label).join("、") : "还没有关联人物"}</span>
          </div>
        </GlassCard>
      </section>

      <CompletionTipsSection tips={completionTips} onAction={() => setEditing(true)} />

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 地点信息
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row">
            <strong>国家 / 省 / 市</strong>
            <span>{buildPlaceGeoLine(place)}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>区 / 商圈</strong>
            <span>{place.area || "未设置"}</span>
          </GlassCard>
          {place.mall ? (
            <button
              className="detail-row detail-button glass-card"
              onClick={() => navigate(`/places/malls/${encodeURIComponent(buildMallKey(place))}`)}
            >
              <strong>商场 / 园区</strong>
              <span>{[place.mall, place.storeName].filter(Boolean).join(" · ")}</span>
            </button>
          ) : (
            <GlassCard className="detail-row">
              <strong>店铺 / 场所</strong>
              <span>{place.storeName || "未设置"}</span>
            </GlassCard>
          )}
          <GlassCard className="detail-row">
            <strong>类型</strong>
            <span>{place.category}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>地址</strong>
            <span>{place.address || "未设置"}</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>评分</strong>
            <span>{place.rating ? place.rating : "未获取"}</span>
          </GlassCard>
        </div>
      </section>

      <section className="section">
        <div className="action-grid">
          {place.mapUrl || (place.latitude && place.longitude) ? (
            <button className="link-action" type="button" onClick={() => void openPlaceMap(place)}>
              <Navigation /> 打开高德
            </button>
          ) : (
            <span className="link-action disabled">
              <Navigation /> 未设置地图
            </span>
          )}
          {platformLinks.map((link) => (
            <button className="link-action secondary" type="button" key={`${link.platform}-${link.url}`} onClick={() => void openNativeStoreUrl(link.url)}>
              <Store /> 打开{link.label}
            </button>
          ))}
          {referenceUrl ? (
            <button className="link-action" type="button" onClick={() => void openExternalUrl(referenceUrl)}>
              <ExternalLink /> 参考链接
            </button>
          ) : (
            <span className="link-action disabled">
              <ExternalLink /> 未设置链接
            </span>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Camera /> 照片
          </h2>
        </div>
        {photos.length ? (
          <div className="place-photo-strip">
            {photos.map((photo) => (
              <img
                alt={place.name}
                className="place-photo"
                key={photo}
                loading="lazy"
                referrerPolicy="no-referrer"
                src={photo}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
        ) : (
          <GlassCard className="empty">还没有照片，可以编辑地点上传本地图片或添加图片链接</GlassCard>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>评价</h2>
        </div>
        <GlassCard className="pref-block">
          <p className="memory-desc">{place.desc || "还没有评价"}</p>
          <Tags items={place.tags} />
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 一起去过的人
          </h2>
        </div>
        {relatedPeople.length ? (
          <div className="tap-chip-row">
            {relatedPeople.map((personId) => (
              <button className="tap-chip" key={personId} onClick={() => navigate(`/people/${personId}`)}>
                {getPersonName(personId)}
              </button>
            ))}
          </div>
        ) : (
          <GlassCard className="empty">还没有关联人物</GlassCard>
        )}
      </section>

      <MemoryTimelineSection
        title="地点时间线"
        groupedMemories={groupedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingMemory(true)}
        emptyTitle="还没有在这里发生的回忆"
        emptyDesc="记录一次到访，让这个地点变得更有故事。"
        emptyAction="记录在这里发生的事"
        renderMeta={(memory, ctx, showContentLine) => (
          <p className="memory-desc">
            {ctx.personNames.join("、") || "未关联人物"}
            {showContentLine ? ` · ${memory.content}` : ""}
          </p>
        )}
      />

      <EntrySheet type={editing ? "place" : null} itemId={place.id} onClose={() => setEditing(false)} />
      <EntrySheet
        type={addingMemory ? "memory" : null}
        initialPlaceId={place.id}
        memoryMode="quick"
        onClose={() => setAddingMemory(false)}
      />
    </>
  );
}
