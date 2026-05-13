import { ArrowLeft, Calendar, Heart, MapPin, Sparkles, Tag, Users, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { PhotoGrid } from "../../components/PhotoGrid";
import { PhotoViewer } from "../../components/PhotoViewer";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { formatMonthDay } from "../../utils/date";
import { buildPlaceContextLine } from "../../utils/placeMeta";
import { buildMemoryDisplayContext, getMemoryDisplayTitle } from "../../utils/memoryDisplay";
import type { Photo } from "../../types";

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName, loadMemoryPhotos } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
  const [editing, setEditing] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const memory = state.memories.find((item) => item.id === memoryId);
  const personIds = memory?.personIds || [];
  const tags = memory?.tags || [];
  const photoIds = memory?.photos || [];
  const place = state.places.find((item) => item.id === memory?.placeId);

  // 加载照片
  useEffect(() => {
    if (memory && photoIds.length > 0) {
      loadMemoryPhotos(memory.id, photoIds).then(setPhotos);
    } else {
      setPhotos([]);
    }
  }, [memory?.id, photoIds.length, loadMemoryPhotos]);

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
      visible: !memory.placeId
    },
    {
      id: "tags",
      icon: <Tag />,
      title: "补充心情和标签",
      desc: "让以后搜索和回看更容易。",
      visible: memory.mood === "日常" || !tags.length
    }
  ].filter((tip) => tip.visible);

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
        <GlassCard className="pref-block">
          <p className="memory-desc">{memory.content || "还没有记录内容"}</p>
          <Tags items={[memory.mood, ...tags]} />
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
        <button className="detail-row detail-button glass-card" onClick={() => place && navigate(`/places/${place.id}`)}>
          <strong>{getPlaceName(memory.placeId)}</strong>
          <span>{place ? `${place.city} · ${buildPlaceContextLine(place)}` : "未关联地点"}</span>
        </button>
        {place && (
          <button className="category-pill active detail-link-button" onClick={() => navigate(`/places/${place.id}`)}>
            查看地点详情
          </button>
        )}
      </section>

      {viewerOpen && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <EntrySheet type={editing ? "memory" : null} itemId={memory.id} onClose={() => setEditing(false)} />
    </>
  );
}
