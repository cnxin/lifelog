import { Calendar, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries } from "../../utils/date";
import { initials } from "../../utils/text";

export default function Home() {
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const upcoming = getUpcomingAnniversaries(state.people).slice(0, 4);
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);
  const recent = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);

  return (
    <>
      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日
          </h2>
          <button className="see-all" onClick={() => navigate("/people")}>
            查看
          </button>
        </div>
        <div className="anniversary-scroll">
          {upcoming.map((item, index) => (
            <GlassCard key={`${item.personName}-${item.title}`} className={`anniversary-card ${index % 2 ? "secondary" : ""}`}>
              <div className="a-title">
                {item.personName} · {item.title}
              </div>
              <div className="a-days">
                {item.days}
                <span>天</span>
              </div>
              <div className="a-date">{item.label === "今天" ? "就是今天" : item.label}</div>
              <div className="a-date">{item.yearLabel}</div>
              <div className="a-date">{formatMonthDay(item.date)}</div>
              <div className="a-date">{formatLunarDate(item.date)}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="section">
        <GlassCard className="insight-card">
          <div className="metric">
            <strong>{state.people.length}</strong>
            <span>人物</span>
          </div>
          <div className="metric">
            <strong>{state.places.length}</strong>
            <span>地点</span>
          </div>
          <div className="metric">
            <strong>{state.memories.length}</strong>
            <span>回忆</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 收藏的人
          </h2>
          <button className="see-all" onClick={() => navigate("/people")}>
            全部
          </button>
        </div>
        <div className="favorites-grid">
          {favorites.map((person) => (
            <button className="favorite-item favorite-button" key={person.id} onClick={() => navigate(`/people/${person.id}`)}>
              <div className="fav-avatar">{initials(person.name)}</div>
              <div className="fav-name">{person.name}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Clock /> 最近回忆
          </h2>
          <button className="see-all" onClick={() => navigate("/memories")}>
            全部
          </button>
        </div>
        <div className="list">
          {recent.map((memory) => (
            <GlassCard className="memory-card" key={memory.id}>
              <button className="place-tap" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-badge">♡</div>
              </button>
              <div className="memory-info" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-title">
                  <span>{memory.title}</span>
                  <span className="place-rating">{formatMonthDay(memory.date)}</span>
                </div>
                <p className="memory-desc">
                  {memory.personIds.map(getPersonName).join("、")} · {getPlaceName(memory.placeId)}
                </p>
                <p className="memory-desc">{memory.content}</p>
                <Tags items={[memory.mood, ...memory.tags]} />
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </>
  );
}
