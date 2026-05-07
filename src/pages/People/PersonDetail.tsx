import { ArrowLeft, Calendar, Gift, Heart, MapPin, Sparkles, Star } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { anniversaryRelativeLabel, anniversaryYearLabel, formatSolarLunar } from "../../utils/date";
import { initials } from "../../utils/text";
import { useEffect, useRef, useState } from "react";

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, getPlaceName } = useLifeLog();
  const [editing, setEditing] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const anniversariesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.hash !== "#anniversaries" || !anniversariesRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameId = requestAnimationFrame(() => {
      anniversariesRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [location.hash, personId]);
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
  const completionTips = [
    {
      id: "birthday",
      icon: <Calendar />,
      title: "补充生日",
      desc: "生日会自动出现在纪念日、日历和首页提醒。",
      visible: !person.birthday
    },
    {
      id: "preferences",
      icon: <Heart />,
      title: "补充喜好",
      desc: "记录颜色、食物、饮品、活动等偏好。",
      visible: !person.preferences.length
    },
    {
      id: "dislikes",
      icon: <Sparkles />,
      title: "补充禁忌",
      desc: "把过敏、口味、雷区提前记下来。",
      visible: !person.dislikes.length
    },
    {
      id: "anniversaries",
      icon: <Gift />,
      title: "补充纪念日",
      desc: "相识日、重要节点会自动计算农历和周年。",
      visible: person.anniversaries.length <= (person.birthday ? 1 : 0)
    }
  ].filter((tip) => tip.visible);

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

      <section className="section" ref={anniversariesRef}>
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日
          </h2>
        </div>
        <div className="list">
          {person.anniversaries.map((item) => (
            <GlassCard className="anniversary-detail-card" key={`${item.title}-${item.date}`}>
              <div className="anniversary-detail-head">
                <strong>{item.title}</strong>
                <span className="anniversary-detail-date">{item.date}</span>
              </div>
              <div className="anniversary-detail-meta">
                {anniversaryRelativeLabel(item.date)} · {anniversaryYearLabel(item.date)}
              </div>
            </GlassCard>
          ))}
          {!person.anniversaries.length && (
            <GlassCard className="empty">
              还没有纪念日，点击上方“编辑资料”补充。
            </GlassCard>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 一起去过
          </h2>
        </div>
        <div className="related-places-row">
          {relatedPlaces.map((placeId) => (
            <button
              key={placeId}
              className="tap-chip"
              onClick={() => navigate(`/places/${placeId}`)}
            >
              {getPlaceName(placeId)}
            </button>
          ))}
          {!relatedPlaces.length && <GlassCard className="empty">还没有一起去过的地点</GlassCard>}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>相关回忆</h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            新增
          </button>
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
      <EntrySheet
        type={addingMemory ? "memory" : null}
        initialPersonId={person.id}
        onClose={() => setAddingMemory(false)}
      />
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
  if (!groups.length) return <GlassCard className="empty">{emptyText}，可以点击“编辑资料”补充。</GlassCard>;

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
