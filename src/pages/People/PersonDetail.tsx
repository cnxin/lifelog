import { ArrowLeft, Calendar, Heart, MapPin, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { anniversaryRelativeLabel, anniversaryYearLabel, formatSolarLunar } from "../../utils/date";
import { initials } from "../../utils/text";
import { useState } from "react";

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { state, getPlaceName } = useLifeLog();
  const [editing, setEditing] = useState(false);
  const person = state.people.find((item) => item.id === personId);

  if (!person) {
    return (
      <section className="section">
        <GlassCard className="empty">没有找到这个人物</GlassCard>
      </section>
    );
  }

  const relatedMemories = state.memories
    .filter((memory) => memory.personIds.includes(person.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const relatedPlaces = Array.from(
    new Set(relatedMemories.map((memory) => memory.placeId).filter(Boolean))
  );

  return (
    <>
      <section className="section">
        <button className="back-button" onClick={() => navigate("/people")}>
          <ArrowLeft /> 返回人物
        </button>
        <GlassCard className="profile-card">
          <div className="profile-photo">{initials(person.name)}</div>
          <div className="profile-main">
            <div className="profile-title">
              <h2>
                {person.name}
                {person.nickname ? ` · ${person.nickname}` : ""}
              </h2>
              {person.favorite && <Star />}
            </div>
            <p>{person.relationship}</p>
            {person.birthday && (
              <p>
                公历生日 · {person.birthday}
                <br />
                {formatSolarLunar(person.birthday)}
              </p>
            )}
            <button className="category-pill active" onClick={() => setEditing(true)}>
              编辑资料
            </button>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Heart /> 喜好档案
          </h2>
        </div>
        <PreferenceBlocks groups={person.preferences} emptyText="还没有记录喜好" />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>禁忌 / 雷区</h2>
        </div>
        <PreferenceBlocks groups={person.dislikes} emptyText="还没有记录禁忌" danger />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日
          </h2>
        </div>
        <div className="list">
          {person.anniversaries.map((item) => (
            <GlassCard className="detail-row" key={`${item.title}-${item.date}`}>
              <strong>{item.title}</strong>
              <span>
                {formatSolarLunar(item.date)} · {anniversaryRelativeLabel(item.date)} · {anniversaryYearLabel(item.date)}
              </span>
            </GlassCard>
          ))}
          {!person.anniversaries.length && <GlassCard className="empty">还没有纪念日</GlassCard>}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 一起去过
          </h2>
        </div>
        <Tags items={relatedPlaces.map(getPlaceName)} />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>相关回忆</h2>
        </div>
        <div className="list">
          {relatedMemories.map((memory) => (
            <GlassCard className="memory-card" key={memory.id}>
              <div className="memory-badge">♡</div>
              <div className="memory-info" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-title">
                  <span>{memory.title}</span>
                  <span className="place-rating">{formatSolarLunar(memory.date)}</span>
                </div>
                <p className="memory-desc">
                  {getPlaceName(memory.placeId)} · {memory.content}
                </p>
                <Tags items={[memory.mood, ...memory.tags]} />
              </div>
            </GlassCard>
          ))}
          {!relatedMemories.length && <GlassCard className="empty">还没有相关回忆</GlassCard>}
        </div>
      </section>

      <EntrySheet type={editing ? "person" : null} itemId={person.id} onClose={() => setEditing(false)} />
    </>
  );
}

function PreferenceBlocks({
  groups,
  emptyText,
  danger = false
}: {
  groups: Array<{ category: string; items: string[] }>;
  emptyText: string;
  danger?: boolean;
}) {
  if (!groups.length) return <GlassCard className="empty">{emptyText}</GlassCard>;

  return (
    <div className="pref-grid">
      {groups.map((group) => (
        <GlassCard className="pref-block" key={group.category}>
          <strong>{group.category}</strong>
          <div className="tags">
            {group.items.map((item) => (
              <span className={`tag ${danger ? "orange" : ""}`} key={item}>
                {item}
              </span>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
