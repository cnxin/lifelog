import { ArrowLeft, Calendar, Gift, Heart, MapPin, Sparkles, Star } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CompletionTipsSection, { type CompletionTip } from "../../components/CompletionTipsSection";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryTimelineSection from "../../components/MemoryTimelineSection";
import { useLifeLog } from "../../context/LifeLogContext";
import { useCollapsingDetailHeader } from "../../hooks/useCollapsingDetailHeader";
import { anniversaryRelativeLabel, anniversaryYearLabel, birthdayAgeLabel, formatMonthDay, getLunarDateInfo } from "../../utils/date";
import { groupMemoriesByMonth, getTopRelatedItems } from "../../utils/detailHelpers";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { buildRelationshipHealth } from "../../utils/relationshipHealth";
import { initials } from "../../utils/text";
import { useEffect, useRef, useState } from "react";

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const headerCollapsed = useCollapsingDetailHeader();
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
    .filter((memory) => (memory.personIds || []).includes(person.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const relatedPlaces = Array.from(
    new Set(relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean))
  );
  const relationshipHealth = buildRelationshipHealth(person.id, state.memories);
  const topPlaces = getTopRelatedItems(
    relatedMemories.flatMap(getMemoryPlaceIds).filter(Boolean),
    getPlaceName
  );
  const groupedMemories = groupMemoriesByMonth(relatedMemories);
  const latestMemory = relatedMemories[0];
  const completionTips: CompletionTip[] = [
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
  ];

  return (
    <>
      <section className={`section detail-hero-section ${headerCollapsed ? "collapsed" : ""}`}>
        <GlassCard className="profile-card detail-profile-card person-detail-profile-card">
          {person.favorite && <Star className="person-profile-favorite" />}
          <div className="detail-profile-nav">
            <button className="back-button" type="button" onClick={() => navigate("/people")}>
              <ArrowLeft /> 返回人物
            </button>
            <strong className="detail-compact-title">
              {person.name}
              {person.nickname ? ` · ${person.nickname}` : ""}
            </strong>
          </div>
          <div className="detail-profile-body">
            <div className="profile-photo">{initials(person.name)}</div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>
                  {person.name}
                  {person.nickname ? ` · ${person.nickname}` : ""}
                </h2>
              </div>
              <p>{person.relationship}</p>
              {person.birthday && <BirthdaySummary date={person.birthday} />}
              <button className="category-pill active person-profile-edit" onClick={() => setEditing(true)}>
                编辑资料
              </button>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="section person-detail-section">
        <div className="section-header">
          <h2>
            <Heart /> 关系摘要
          </h2>
          <button className="see-all" onClick={() => setAddingMemory(true)}>
            记录
          </button>
        </div>
        <GlassCard className="detail-summary-card">
          <div className="summary-grid">
            <div className="summary-metric">
              <strong>{relatedMemories.length}</strong>
              <span>共同回忆</span>
            </div>
            <div className="summary-metric">
              <strong>{latestMemory ? formatMonthDay(latestMemory.date) : "暂无"}</strong>
              <span>最近一次</span>
            </div>
          </div>
          <div className="summary-line">
            <strong>关系</strong>
            <span>{person.relationship || "未设置"}</span>
          </div>
          <div className="summary-line">
            <strong>关系温度</strong>
            <span>
              <span className={`relationship-health-pill inline ${relationshipHealth.temperature}`}>{relationshipHealth.label}</span>
              {" "}{relationshipHealth.detail}
            </span>
          </div>
          <div className="summary-line">
            <strong>常出现地点</strong>
            <span>{topPlaces.length ? topPlaces.map((item) => item.label).join("、") : "还没有共同地点"}</span>
          </div>
        </GlassCard>
      </section>

      <CompletionTipsSection tips={completionTips} onAction={() => setEditing(true)} />

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

      <section className="section person-detail-section" ref={anniversariesRef}>
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
                {anniversaryRelativeLabel(item.date)} · {item.title === "生日" ? birthdayAgeLabel(item.date) : anniversaryYearLabel(item.date)}
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

      <section className="section person-detail-section">
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

      <MemoryTimelineSection
        title="回忆时间线"
        groupedMemories={groupedMemories}
        getPersonName={getPersonName}
        getPlaceName={getPlaceName}
        onAddMemory={() => setAddingMemory(true)}
        emptyTitle="还没有和 TA 相关的回忆"
        emptyDesc="记录一次相处，让这个人物变得更完整。"
        emptyAction="记录和 TA 的回忆"
      />

      <EntrySheet type={editing ? "person" : null} itemId={person.id} onClose={() => setEditing(false)} />
      <EntrySheet
        type={addingMemory ? "memory" : null}
        initialPersonId={person.id}
        memoryMode="quick"
        onClose={() => setAddingMemory(false)}
      />
    </>
  );
}

function BirthdaySummary({ date }: { date: string }) {
  const lunar = getLunarDateInfo(date);

  return (
    <p className="person-birthday-summary">
      <span>公历生日 · {date}</span>
      {lunar ? (
        <>
          <span>{lunar.lunarText}</span>
          <span>{lunar.ganZhiText}</span>
        </>
      ) : (
        <span>农历信息暂不可用</span>
      )}
    </p>
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
