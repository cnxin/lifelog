import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatCalendarLunarSummary, formatMonthDay, getLunarDateInfo } from "../../utils/date";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, isManualTitle } from "../../utils/memoryDisplay";

type CalendarItem = {
  id: string;
  dateKey: string;
  title: string;
  subtitle: string;
  subtitleLines?: string[];
  content?: string;
  tagItems?: string[];
  type: "person" | "memory";
  target: string;
};

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

export default function Calendar() {
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [showLunar, setShowLunar] = useState(true);
  const todayKey = toDateKey(today);

  const monthDays = useMemo(() => buildMonthDays(cursor), [cursor]);
  const items = useMemo(() => buildCalendarItems(cursor, state, getPersonName, getPlaceName), [
    cursor,
    getPersonName,
    getPlaceName,
    state
  ]);
  const itemsByDate = useMemo(() => groupByDate(items), [items]);
  const selectedItems = itemsByDate[selectedDate] || [];
  const selectedLunar = getLunarDateInfo(selectedDate);

  function moveMonth(offset: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelectedDate(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  function backToToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toDateKey(now));
  }

  return (
    <>
      <section className="section">
        <GlassCard className="calendar-panel">
          <div className="calendar-header">
            <button className="icon-action" onClick={() => moveMonth(-1)} aria-label="上个月">
              <ChevronLeft />
            </button>
            <div className="calendar-title-block">
              <h2>
                {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
              </h2>
              {selectedLunar ? (
                <>
                  <p className="calendar-lunar-line">{selectedLunar.ganZhiZodiacText}</p>
                  <p className="calendar-week-line">{selectedLunar.weekText} {selectedLunar.weekOfYearText}</p>
                  <p className="calendar-date-line">{selectedLunar.lunarText}</p>
                </>
              ) : (
                <p className="calendar-week-line">农历转换不可用</p>
              )}
            </div>
            <button className="icon-action" onClick={() => moveMonth(1)} aria-label="下个月">
              <ChevronRight />
            </button>
          </div>

          <div className="calendar-today-row">
            <button className="category-pill calendar-today-btn" onClick={backToToday}>
              回到今天
            </button>
          </div>

          <button
            className={`date-lunar-toggle calendar-lunar-toggle ${showLunar ? "active" : ""}`}
            type="button"
            onClick={() => setShowLunar((current) => !current)}
          >
            {showLunar ? "隐藏农历" : "显示农历"}
          </button>

          <div className="calendar-week">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={`calendar-grid ${showLunar ? "with-lunar" : ""}`}>
            {monthDays.map((day) => {
              const dateItems = itemsByDate[day.dateKey] || [];
              return (
                <button
                  className={`calendar-day ${day.inMonth ? "" : "muted-day"} ${
                    selectedDate === day.dateKey ? "active" : ""
                  } ${day.dateKey === todayKey ? "today" : ""}`}
                  key={day.dateKey}
                  onClick={() => setSelectedDate(day.dateKey)}
                >
                  <span>{day.date.getDate()}</span>
                  {showLunar && <small>{getLunarDateInfo(day.dateKey)?.cellText}</small>}
                  {dateItems.length > 0 && <i>{dateItems.length}</i>}
                </button>
              );
            })}
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>{formatMonthDay(selectedDate)} 的记录</h2>
        </div>
        <div className="list">
          {selectedItems.map((item) => (
            <button className="calendar-item glass-card" key={item.id} onClick={() => navigate(item.target)}>
              <strong>{item.title}</strong>
              {item.subtitleLines ? (
                <div className="calendar-item-meta">
                  {item.subtitleLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              ) : (
                <>
                  {item.subtitle && <span className="memory-meta-line">{item.subtitle}</span>}
                  {item.content && <p className="memory-desc calendar-memory-content">{item.content}</p>}
                  {item.tagItems?.length ? (
                    <div className="memory-tags-line calendar-memory-tags">
                      <Tags items={item.tagItems} />
                    </div>
                  ) : null}
                </>
              )}
            </button>
          ))}
          {!selectedItems.length && <GlassCard className="empty">这一天还没有记录</GlassCard>}
        </div>
      </section>
    </>
  );
}

function buildMonthDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      dateKey: toDateKey(date),
      inMonth: date.getMonth() === month
    };
  });
}

function buildCalendarItems(
  cursor: Date,
  state: ReturnType<typeof useLifeLog>["state"],
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
): CalendarItem[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const peopleItems = state.people.flatMap((person) =>
    person.anniversaries
      .map((anniversary) => {
        const date = new Date(`${anniversary.date}T00:00:00`);
        const eventDate = new Date(year, date.getMonth(), date.getDate());
        const dateKey = toDateKey(eventDate);
        const summary = formatCalendarLunarSummary(dateKey);
        return {
          id: `person-${person.id}-${anniversary.title}`,
          dateKey,
          title: `${person.name} · ${anniversary.title}`,
          subtitle: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean).join(" · "),
          subtitleLines: [summary.ganZhiLine, summary.weekLine, summary.lunarLine].filter(Boolean),
          type: "person" as const,
          target: `/people/${person.id}#anniversaries`
        };
      })
      .filter((item) => new Date(`${item.dateKey}T00:00:00`).getMonth() === month)
  );

  const memoryItems = state.memories
    .filter((memory) => new Date(`${memory.date}T00:00:00`).getMonth() === month)
    .map((memory) => {
      const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
      const content = isManualTitle(memory) ? memory.content.trim() : "";
      return {
        id: `memory-${memory.id}`,
        dateKey: memory.date,
        title: getMemoryDisplayTitle(memory, ctx),
        subtitle: [ctx.personNames.join("、"), ctx.placeName].filter(Boolean).join(" · ") || "未关联",
        content,
        tagItems: [memory.mood, ...(memory.tags || [])].filter(Boolean),
        type: "memory" as const,
        target: `/memories/${memory.id}`
      };
    });

  return [...peopleItems, ...memoryItems].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function groupByDate(items: CalendarItem[]) {
  return items.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    acc[item.dateKey] = [...(acc[item.dateKey] || []), item];
    return acc;
  }, {});
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
