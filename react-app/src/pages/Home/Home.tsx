import { Calendar, Clock, Heart, MapPin, PenLine, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import { useLifeLog } from "../../context/LifeLogContext";
import type { EntryType, MemoryEvent } from "../../types";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries, todayLabel } from "../../utils/date";
import { buildMemoryDisplayContext } from "../../utils/memoryDisplay";
import { initials } from "../../utils/text";

export default function Home() {
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const [entrySheetType, setEntrySheetType] = useState<EntryType | null>(null);
  const upcoming = getUpcomingAnniversaries(state.people)
    .filter((item) => item.deltaDays >= 0 && item.deltaDays <= 30)
    .slice(0, 4);
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);
  const recent = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const monthlyMemoryCount = countMemoriesInCurrentMonth(state.memories);
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
      <section className="section home-hero-section">
        <div className="home-hero-copy">
          <span>{todayLabel()}</span>
          <h1>今天的 LifeLog</h1>
          <p>快速回看最近的人、地点和回忆，从一件小事开始继续记录。</p>
        </div>
        <GlassCard className="insight-card home-overview-card">
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
          <div className="metric metric-wide">
            <strong>{monthlyMemoryCount}</strong>
            <span>本月新增回忆</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <button className="quick-memory-card" onClick={() => setEntrySheetType("memory")}>
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
            <Calendar /> 未来 30 天
          </h2>
          <button className="see-all" onClick={() => navigate("/calendar")}>
            查看
          </button>
        </div>
        {upcoming.length > 0 ? (
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
        ) : (
          <GlassCard className="home-empty-card">
            <strong>未来 30 天暂无纪念日</strong>
            <span>补充人物生日或纪念日后，这里会自动提醒。</span>
            <button onClick={() => setEntrySheetType("person")}>添加人物</button>
          </GlassCard>
        )}
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
        {favorites.length > 0 ? (
          <div className="favorites-grid">
            {favorites.map((person) => (
              <button className="favorite-item favorite-button" key={person.id} onClick={() => navigate(`/people/${person.id}`)}>
                <div className="fav-avatar">{initials(person.name)}</div>
                <div className="fav-name">{person.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <GlassCard className="home-empty-card compact">
            <strong>还没有收藏人物</strong>
            <span>把重要的人设为收藏后，首页会优先显示 TA。</span>
            <button onClick={() => navigate("/people")}>去看看人物</button>
          </GlassCard>
        )}
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
        {recent.length > 0 ? (
          <div className="list">
            {recent.map((memory) => {
              const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
              return (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  ctx={ctx}
                  icon="♡"
                  onOpen={() => navigate(`/memories/${memory.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <GlassCard className="home-empty-card">
            <strong>还没有记录回忆</strong>
            <span>从今天发生的一件小事开始，建立你的第一条 LifeLog。</span>
            <div className="home-empty-actions">
              <button onClick={() => setEntrySheetType("memory")}>记录一条回忆</button>
              <button onClick={() => setEntrySheetType("place")}>添加地点</button>
            </div>
          </GlassCard>
        )}
      </section>
      <EntrySheet
        type={entrySheetType}
        memoryMode={entrySheetType === "memory" ? "quick" : "full"}
        onClose={() => setEntrySheetType(null)}
      />
    </>
  );
}

function countMemoriesInCurrentMonth(memories: MemoryEvent[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  return memories.filter((memory) => {
    const time = new Date(`${memory.date}T00:00:00`).getTime();
    return time >= monthStart && time < nextMonthStart;
  }).length;
}
