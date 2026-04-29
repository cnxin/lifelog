import { ArrowLeft, Calendar, Heart, MapPin, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatMonthDay } from "../../utils/date";

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const [editing, setEditing] = useState(false);
  const memory = state.memories.find((item) => item.id === memoryId);
  const place = state.places.find((item) => item.id === memory?.placeId);

  if (!memory) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这条回忆</GlassCard>
      </section>
    );
  }

  return (
    <>
      <section className="section">
        <button className="back-button" onClick={() => navigate("/memories")}>
          <ArrowLeft /> 返回回忆
        </button>
        <GlassCard className="profile-card">
          <div className="profile-photo">
            <Heart />
          </div>
          <div className="profile-main">
            <div className="profile-title">
              <h2>{memory.title}</h2>
            </div>
            <p>
              {formatMonthDay(memory.date)} · {memory.mood}
            </p>
            <button className="category-pill active" onClick={() => setEditing(true)}>
              编辑回忆
            </button>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 内容
          </h2>
        </div>
        <GlassCard className="pref-block">
          <p className="memory-desc">{memory.content || "还没有记录内容"}</p>
          <Tags items={[memory.mood, ...memory.tags]} />
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 关联人物
          </h2>
        </div>
        <div className="tap-chip-row">
          {memory.personIds.map((personId) => (
            <button className="tap-chip" key={personId} onClick={() => navigate(`/people/${personId}`)}>
              {getPersonName(personId)}
            </button>
          ))}
          {!memory.personIds.length && <GlassCard className="empty">未关联人物</GlassCard>}
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
          <span>{place ? `${place.city} · ${place.area || "未分组"}` : "未关联地点"}</span>
        </button>
        {place && (
          <button className="category-pill active detail-link-button" onClick={() => navigate(`/places/${place.id}`)}>
            查看地点详情
          </button>
        )}
      </section>

      <EntrySheet type={editing ? "memory" : null} itemId={memory.id} onClose={() => setEditing(false)} />
    </>
  );
}
