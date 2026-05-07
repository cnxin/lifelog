import { Calendar, Clock, Heart, MapPin, PenLine, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries } from "../../utils/date";
import { initials } from "../../utils/text";

export default function Home() {
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const [quickMemoryOpen, setQuickMemoryOpen] = useState(false);
  const upcoming = getUpcomingAnniversaries(state.people).slice(0, 4);
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);
  const recent = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const tasks = [
    {
      id: "people-birthday",
      icon: <Users />,
      count: state.people.filter((person) => !person.birthday).length,
      title: "补充生日",
      desc: "生日和纪念日会出现在首页与日历",
      path: "/people"
    },
    {
      id: "people-preferences",
      icon: <Heart />,
      count: state.people.filter((person) => !person.preferences.length && !person.dislikes.length).length,
      title: "补充喜好",
      desc: "记录颜色、食物、禁忌和送礼线索",
      path: "/people"
    },
    {
      id: "place-map",
      icon: <MapPin />,
      count: state.places.filter((place) => !place.mapUrl && !(place.latitude && place.longitude)).length,
      title: "补充高德入口",
      desc: "有高德链接后可以直接从地点详情打开高德",
      path: "/places"
    }
  ].filter((task) => task.count > 0);

  return (
    <>
      <section className="section">
        <button className="quick-memory-card" onClick={() => setQuickMemoryOpen(true)}>
          <div className="quick-memory-icon">
            <PenLine />
          </div>
          <div>
            <strong>快速记录</strong>
            <span>先用一句话记下今天的人、地点和事情</span>
          </div>
        </button>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日
          </h2>
          <button className="see-all" onClick={() => navigate("/calendar")}>
            查看
          </button>
        </div>
        <div className="anniversary-scroll-wrapper">
          <div className="anniversary-scroll">
            {upcoming.map((item, index) => (
              <button
                key={`${item.personName}-${item.title}`}
                className={`anniversary-card glass-card ${index % 2 ? "secondary" : ""}`}
                onClick={() => navigate(`/people/${item.personId}#anniversaries`)}
              >
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
              </button>
            ))}
          </div>
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

      {tasks.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Sparkles /> 待补全
            </h2>
          </div>
          <div className="task-grid">
            {tasks.slice(0, 4).map((task) => (
              <button className="task-card" key={task.id} onClick={() => navigate(task.path)}>
                <div className="task-icon">{task.icon}</div>
                <div>
                  <strong>
                    {task.count} 项 · {task.title}
                  </strong>
                  <span>{task.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

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
      <EntrySheet type={quickMemoryOpen ? "memory" : null} memoryMode="quick" onClose={() => setQuickMemoryOpen(false)} />
    </>
  );
}
