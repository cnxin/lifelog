import { ArrowLeft, Camera, ExternalLink, Heart, MapPin, Navigation, PenLine, QrCode, Share2, Sparkles, Star, Store, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CompletionTipsSection, { type CompletionTip } from "../../components/CompletionTipsSection";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import LocalShareSheet from "../../components/LocalShareSheet";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import NotionRecordAction from "../../components/NotionRecordAction";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { formatMonthDay } from "../../utils/date";
import { groupMemoriesByMonth, getTopRelatedItems } from "../../utils/detailHelpers";
import { openExternalUrl, openNativeStoreUrl, openPlaceMap } from "../../utils/externalLinks";
import { isMemoryPlan } from "../../utils/memoryDisplay";
import { hasMemoryPlace } from "../../utils/memoryPlaces";
import { normalizePlacePlatformLinks } from "../../utils/placeLinks";
import { buildPlaceVisitStats } from "../../utils/placeVisitStats";
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
  const [shareOpen, setShareOpen] = useState(false);
  const place = state.places.find((item) => item.id === placeId);

  if (!place) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个地点</GlassCard>
      </section>
    );
  }

  const relatedEntries = state.memories
    .filter((memory) => hasMemoryPlace(memory, place.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const relatedMemories = relatedEntries.filter((memory) => !isMemoryPlan(memory));
  const relatedPlans = relatedEntries.filter(isMemoryPlan);

  const relatedPeople = Array.from(
    new Set(relatedMemories.flatMap((memory) => memory.personIds || []).filter(Boolean))
  );
  const topPeople = getTopRelatedItems(
    relatedMemories.flatMap((memory) => memory.personIds || []).filter(Boolean),
    getPersonName
  );
  const visitStats = buildPlaceVisitStats(place.id, state.memories, getPersonName);
  const groupedMemories = groupMemoriesByMonth(relatedEntries);
  const latestMemory = relatedMemories[0];
  const photos = (place.photos || []).slice(0, 3);
  const platformLinks = normalizePlacePlatformLinks(place.platformLinks);
  const referenceUrl = getPlaceReferenceUrl(place);
  const nextUseCards = buildPlaceNextUseCards({
    place,
    topPeople,
    visitStats,
    hasMap: Boolean(place.mapUrl || (place.latitude && place.longitude)),
    hasReference: Boolean(referenceUrl || platformLinks.length),
    onRecordMemory: () => setAddingMemory(true),
    onEditPlace: () => setEditing(true),
    onOpenMap: () => {
      void openPlaceMap(place);
    },
    onOpenPerson: (personId) => navigate(`/people/${personId}`)
  });
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
              <div className="detail-profile-actions">
                <button className="category-pill active" onClick={() => setEditing(true)}>
                  编辑地点
                </button>
                <NotionRecordAction entityType="place" entityId={place.id} />
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <GlassCard className="detail-share-card">
          <div className="detail-share-copy">
            <span className="detail-share-icon">
              <Share2 />
            </span>
            <div>
              <strong>分享这个地点</strong>
              <span>可选择地址、定位、外部链接和图片是否公开，支持链接、二维码或分享包。</span>
            </div>
          </div>
          <button className="detail-share-button" type="button" onClick={() => setShareOpen(true)}>
            <QrCode /> 打开分享
          </button>
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
              <span>到访回忆</span>
            </div>
            <div className="summary-metric">
              <strong>{latestMemory ? formatMonthDay(latestMemory.date) : "暂无"}</strong>
              <span>最近一次</span>
            </div>
          </div>
          {relatedPlans.length > 0 && (
            <div className="summary-line">
              <strong>计划</strong>
              <span>{relatedPlans.length} 条待发生记录</span>
            </div>
          )}
          <div className="summary-line">
            <strong>类型</strong>
            <span>{place.category || "未设置"}</span>
          </div>
          <div className="summary-line">
            <strong>到访状态</strong>
            <span>
              {visitStats.visitCount ? `去过 ${visitStats.visitCount} 次 · ${visitStats.latestLabel}` : "还没有到访记录"}
            </span>
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
            <Sparkles /> 下次怎么用
          </h2>
          <button className="see-all" type="button" onClick={() => setAddingMemory(true)}>
            记到访
          </button>
        </div>
        <div className="place-use-grid">
          {nextUseCards.map((card) => (
            <button className={`place-use-card glass-card ${card.tone}`} type="button" key={card.id} onClick={card.onClick}>
              <span>{card.icon}</span>
              <strong>{card.title}</strong>
              <small>{card.desc}</small>
            </button>
          ))}
        </div>
      </section>

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
            <button className="link-action secondary" type="button" key={`${link.platform}-${link.url}`} onClick={() => void openNativeStoreUrl(link.url, link.platform)}>
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
        title="地点记录"
        groupedMemories={groupedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingMemory(true)}
        emptyTitle="还没有在这里发生的记录"
        emptyDesc="记录一次到访或计划，让这个地点变得更有故事。"
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
      <LocalShareSheet
        target={
          shareOpen
            ? {
                type: "places",
                placeIds: [place.id],
                title: buildPlaceDisplayName(place),
                count: 1
              }
            : null
        }
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}

function buildPlaceNextUseCards({
  place,
  topPeople,
  visitStats,
  hasMap,
  hasReference,
  onRecordMemory,
  onEditPlace,
  onOpenMap,
  onOpenPerson
}: {
  place: {
    category: string;
    rating: number;
    desc: string;
    tags: string[];
  };
  topPeople: Array<{ id: string; label: string; count: number }>;
  visitStats: { visitCount: number; latestLabel: string };
  hasMap: boolean;
  hasReference: boolean;
  onRecordMemory: () => void;
  onEditPlace: () => void;
  onOpenMap: () => void;
  onOpenPerson: (personId: string) => void;
}) {
  const category = place.category || "地点";
  const peopleHint = topPeople.length ? `适合和 ${topPeople.map((item) => item.label).join("、")} 再来。` : "下次记录到访时可以顺手关联人物。";
  const tagHint = place.tags.length ? place.tags.slice(0, 3).join("、") : place.desc || "还没有推荐点，可以下次到访后补一句。";

  return [
    {
      id: "occasion",
      icon: <Heart />,
      title: getPlaceOccasionTitle(category),
      desc: peopleHint,
      tone: "warm",
      onClick: topPeople[0] ? () => onOpenPerson(topPeople[0].id) : onRecordMemory
    },
    {
      id: "recommend",
      icon: <Sparkles />,
      title: place.rating ? `评分 ${place.rating}` : "补一个推荐点",
      desc: tagHint,
      tone: place.tags.length || place.desc ? "cool" : "warm",
      onClick: onEditPlace
    },
    {
      id: "route",
      icon: hasMap ? <Navigation /> : <MapPin />,
      title: hasMap ? "可以直接导航" : "还缺地图入口",
      desc: hasMap ? "下次出门前可以从这里打开地图或店铺链接。" : "补充地图链接后，下次不用重新搜索。",
      tone: hasMap ? "cool" : "warm",
      onClick: hasMap ? onOpenMap : onEditPlace
    },
    {
      id: "record",
      icon: <PenLine />,
      title: visitStats.visitCount ? `已经去过 ${visitStats.visitCount} 次` : "还没有到访回忆",
      desc: visitStats.visitCount ? `${visitStats.latestLabel}，下次可以补充点单、体验或避雷。` : hasReference ? "点这里记录第一次到访。" : "先记录一次到访，让这个地点更有故事。",
      tone: visitStats.visitCount ? "cool" : "warm",
      onClick: onRecordMemory
    }
  ];
}

function getPlaceOccasionTitle(category: string) {
  if (/餐|饭|咖啡|茶|甜|酒|火锅|烤|料理|小吃/.test(category)) return "适合约饭";
  if (/酒店|民宿|住宿/.test(category)) return "适合住一晚";
  if (/景点|公园|展|馆|影院|电影|剧场/.test(category)) return "适合安排活动";
  if (/商场|店|购物|买/.test(category)) return "适合逛一逛";
  return "适合下次再来";
}
