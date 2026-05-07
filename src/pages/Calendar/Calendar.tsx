import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatLunarDate, formatMonthDay } from "../../utils/date";

type CalendarItem = {
  id: string;
  dateKey: string;
  title: string;
  subtitle: string;
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

  const monthDays = useMemo(() => buildMonthDays(cursor), [cursor]);
  const items = useMemo(() => buildCalendarItems(cursor, state, getPersonName, getPlaceName), [
    cursor,
    getPersonName,
    getPlaceName,
    state
  ]);
  const itemsByDate = useMemo(() => groupByDate(items), [items]);
  const selectedItems = itemsByDate[selectedDate] || [];

  function moveMonth(offset: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelectedDate(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  return (
    <>
      <section className="section">
        <GlassCard className="calendar-panel">
          <div className="calendar-header">
            <button className="icon-action" onClick={() => moveMonth(-1)} aria-label="上个月">
              <ChevronLeft />
            </button>
            <div>
              <h2>
                {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
              </h2>
              <p>{formatLunarDate(selectedDate)}</p>
            </div>
            <button className="icon-action" onClick={() => moveMonth(1)} aria-label="下个月">
              <ChevronRight />
            </button>
          </div>

          <div className="calendar-week">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((day) => {
              const dateItems = itemsByDate[day.dateKey] || [];
              return (
                <button
                  className={`calendar-day ${day.inMonth ? "" : "muted-day"} ${
                    selectedDate === day.dateKey ? "active" : ""
                  }`}
                  key={day.dateKey}
                  onClick={() => setSelectedDate(day.dateKey)}
                >
                  <span>{day.date.getDate()}</span>
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
              <span>{item.subtitle}</span>
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
        return {
          id: `person-${person.id}-${anniversary.title}`,
          dateKey: toDateKey(eventDate),
          title: `${person.name} · ${anniversary.title}`,
          subtitle: formatLunarDate(toDateKey(eventDate)),
          type: "person" as const,
          target: `/people/${person.id}#anniversaries`
        };
      })
      .filter((item) => new Date(`${item.dateKey}T00:00:00`).getMonth() === month)
  );

  const memoryItems = state.memories
    .filter((memory) => new Date(`${memory.date}T00:00:00`).getMonth() === month)
    .map((memory) => ({
      id: `memory-${memory.id}`,
      dateKey: memory.date,
      title: memory.title,
      subtitle: `${memory.personIds.map(getPersonName).join("、")} · ${getPlaceName(memory.placeId)}`,
      type: "memory" as const,
      target: `/memories/${memory.id}`
    }));

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
