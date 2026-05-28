import { ArrowLeft, Calendar, Heart, MapPin, Share2, Sparkles, Tag, Users, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import LocalShareSheet from "../../components/LocalShareSheet";
import MemoryTags from "../../components/MemoryTags";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import { PhotoGrid } from "../../components/PhotoGrid";
import { PhotoViewer } from "../../components/PhotoViewer";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { formatMonthDay } from "../../utils/date";
import { groupMemoriesByMonth } from "../../utils/detailHelpers";
import { buildPlaceContextLine } from "../../utils/placeMeta";
import { buildMemoryDisplayContext, buildMemoryMetaLine, getMemoryDisplayTitle } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import type { MemoryEvent, Photo } from "../../types";

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName, loadMemoryPhotos } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [addingRelated, setAddingRelated] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const memory = state.memories.find((item) => item.id === memoryId);
  const personIds = memory?.personIds || [];
  const tags = memory?.tags || [];
  const photoIds = memory?.photos || [];
  const placeIds = memory ? getMemoryPlaceIds(memory) : [];
  const places = state.places.filter((item) => placeIds.includes(item.id));

  // 加载照片
  useEffect(() => {
    if (memory && photoIds.length > 0) {
      loadMemoryPhotos(memory.id, photoIds).then(setPhotos);
    } else {
      setPhotos([]);
    }
  }, [memory?.id, photoIds.length, loadMemoryPhotos]);

  useEffect(() => {
    if (!memory) return;
    if (searchParams.get("edit") === "photos") {
      setEditing(true);
      setSearchParams({}, { replace: true });
      return;
    }
    if (searchParams.get("add") === "related") {
      setAddingRelated(true);
      setSearchParams({}, { replace: true });
    }
  }, [memory, searchParams, setSearchParams]);

  if (!memory) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这条回忆</GlassCard>
      </section>
    );
  }

  const completionTips = [
    {
      id: "content",
      icon: <Heart />,
      title: "补充内容",
      desc: "写下发生了什么、下次要注意什么。",
      visible: !memory.content.trim()
    },
    {
      id: "people",
      icon: <Users />,
      title: "关联人物",
      desc: "关联后人物详情会自动出现这条回忆。",
      visible: !personIds.length
    },
    {
      id: "place",
      icon: <MapPin />,
      title: "关联地点",
      desc: "关联后地点详情会自动串起去过的人和回忆。",
      visible: !placeIds.length
    },
    {
      id: "tags",
      icon: <Tag />,
      title: "补充心情和标签",
      desc: "让以后搜索和回看更容易。",
      visible: memory.mood === "日常" || !tags.length
    }
  ].filter((tip) => tip.visible);
  const relatedMemoryMatches = buildRelatedMemoryMatches(memory, state.memories);
  const relatedReasonById = new Map(relatedMemoryMatches.map((item) => [item.memory.id, item.reason]));
  const groupedRelatedMemories = groupMemoriesByMonth(relatedMemoryMatches.map((item) => item.memory));

  return (
    <>
      <section className={`section detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card">
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/memories")}>
              <ArrowLeft /> 返回回忆
            </button>
            <strong className="detail-compact-title">
              {getMemoryDisplayTitle(memory, buildMemoryDisplayContext(memory, getPersonName, getPlaceName))}
            </strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">
              <Heart />
            </div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>{getMemoryDisplayTitle(memory, buildMemoryDisplayContext(memory, getPersonName, getPlaceName))}</h2>
              </div>
              <p>
                {formatMonthDay(memory.date)} · {memory.mood}
              </p>
              <button className="category-pill active" onClick={() => setEditing(true)}>
                编辑回忆
              </button>
              <button className="category-pill" onClick={() => setAddingRelated(true)}>
                再记一条相关回忆
              </button>
              <button className="category-pill" onClick={() => setShareOpen(true)}>
                <Share2 size={14} /> 分享
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      {completionTips.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Sparkles /> 建议补充
            </h2>
            <button className="see-all" onClick={() => setEditing(true)}>
              去编辑
            </button>
          </div>
          <div className="completion-list">
            {completionTips.map((tip) => (
              <button className="completion-card" key={tip.id} onClick={() => setEditing(true)}>
                <div className="task-icon">{tip.icon}</div>
                <div>
                  <strong>{tip.title}</strong>
                  <span>{tip.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 内容
          </h2>
        </div>
        <GlassCard className="pref-block memory-content-block">
          <p className="memory-desc">{memory.content || "还没有记录内容"}</p>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Tag /> 心情和标签
          </h2>
        </div>
        <GlassCard className="pref-block memory-tag-block">
          <MemoryTags mood={memory.mood} tags={tags} />
        </GlassCard>
      </section>

      {photos.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <ImageIcon /> 照片 ({photos.length})
            </h2>
          </div>
          <GlassCard>
            <PhotoGrid
              photos={photos}
              columns={3}
              onClick={(index) => {
                setViewerIndex(index);
                setViewerOpen(true);
              }}
            />
          </GlassCard>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 关联人物
          </h2>
        </div>
        <div className="tap-chip-row">
          {personIds.map((personId) => (
            <button className="tap-chip" key={personId} onClick={() => navigate(`/people/${personId}`)}>
              {getPersonName(personId)}
            </button>
          ))}
          {!personIds.length && <GlassCard className="empty">未关联人物</GlassCard>}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 关联地点
          </h2>
        </div>
        {places.length ? (
          <>
            {places.map((place) => (
              <button className="memory-place-row detail-button glass-card" key={place.id} onClick={() => navigate(`/places/${place.id}`)}>
                <strong className="truncate-text">{getPlaceName(place.id)}</strong>
                <span className="truncate-lines-2">{formatPlaceAddressLine(place)}</span>
              </button>
            ))}
          </>
        ) : (
          <GlassCard className="empty">未关联地点，点击“编辑回忆”可以补充。</GlassCard>
        )}
      </section>

      <MemoryTimelineSection
        title="相关回忆"
        groupedMemories={groupedRelatedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingRelated(true)}
        emptyTitle="还没有找到相关回忆"
        emptyDesc="同人物、同地点或同标签的记录会自动出现在这里。"
        emptyAction="再记一条相关回忆"
        renderMeta={(relatedMemory, ctx, showContentLine) => (
          <>
            <p className="memory-desc memory-meta-line">
              {[relatedReasonById.get(relatedMemory.id), buildMemoryMetaLine(ctx)].filter(Boolean).join(" · ")}
            </p>
            {showContentLine && <p className="memory-desc">{relatedMemory.content}</p>}
          </>
        )}
      />

      {viewerOpen && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <EntrySheet type={editing ? "memory" : null} itemId={memory.id} onClose={() => setEditing(false)} />
      <EntrySheet
        type={addingRelated ? "memory" : null}
        initialPersonIds={personIds}
        initialPlaceIds={placeIds}
        memoryMode="quick"
        onClose={() => setAddingRelated(false)}
      />
      <LocalShareSheet
        target={
          shareOpen
            ? {
                type: "memory",
                memoryId: memory.id,
                title: getMemoryDisplayTitle(memory, buildMemoryDisplayContext(memory, getPersonName, getPlaceName)),
                photoCount: photoIds.length
              }
            : null
        }
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}

function formatPlaceAddressLine(place: {
  country: string;
  province: string;
  city: string;
  address: string;
  area: string;
  mall: string;
}) {
  return place.address || [place.province, place.city, buildPlaceContextLine(place)].filter(Boolean).join(" · ");
}

function buildRelatedMemoryMatches(source: MemoryEvent, memories: MemoryEvent[]) {
  return memories
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const match = scoreRelatedMemory(source, candidate);
      return {
        memory: candidate,
        ...match
      };
    })
    .filter((item) => item.score >= 2)
    .sort((left, right) => (
      right.score - left.score ||
      left.dateDistance - right.dateDistance ||
      right.memory.date.localeCompare(left.memory.date)
    ))
    .slice(0, 8);
}

function scoreRelatedMemory(source: MemoryEvent, candidate: MemoryEvent) {
  const reasons: string[] = [];
  let score = 0;

  const personMatches = countIntersection(source.personIds || [], candidate.personIds || []);
  if (personMatches) {
    score += personMatches * 5;
    reasons.push(personMatches > 1 ? `同人物 ${personMatches} 位` : "同人物");
  }

  const placeMatches = countIntersection(getMemoryPlaceIds(source), getMemoryPlaceIds(candidate));
  if (placeMatches) {
    score += placeMatches * 5;
    reasons.push(placeMatches > 1 ? `同地点 ${placeMatches} 个` : "同地点");
  }

  const tagMatches = countIntersection(normalizeTags(source.tags), normalizeTags(candidate.tags));
  if (tagMatches) {
    score += tagMatches * 3;
    reasons.push(tagMatches > 1 ? `同标签 ${tagMatches} 个` : "同标签");
  }

  const dateDistance = getDateDistance(source.date, candidate.date);
  if (dateDistance <= 7) {
    score += 2;
    reasons.push(dateDistance === 0 ? "同一天" : "相近日期");
  } else if (isSameMonth(source.date, candidate.date)) {
    score += 1;
    reasons.push("同月");
  }

  if (source.mood && source.mood !== "日常" && source.mood === candidate.mood) {
    score += 1;
    reasons.push("同心情");
  }

  return {
    score,
    dateDistance,
    reason: uniqueLabels(reasons).slice(0, 3).join(" · ")
  };
}

function countIntersection(left: string[] = [], right: string[] = []) {
  const rightSet = new Set(right.map((item) => item.trim()).filter(Boolean));
  return uniqueLabels(left).filter((item) => rightSet.has(item)).length;
}

function normalizeTags(tags: string[] = []) {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

function uniqueLabels(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function getDateDistance(left: string, right: string) {
  const leftTime = Date.parse(`${left}T00:00:00`);
  const rightTime = Date.parse(`${right}T00:00:00`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((leftTime - rightTime) / 86400000));
}

function isSameMonth(left: string, right: string) {
  return /^\d{4}-\d{2}/.test(left) && left.slice(0, 7) === right.slice(0, 7);
}
