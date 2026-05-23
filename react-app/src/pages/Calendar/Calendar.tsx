import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import MemoryTags from "../../components/MemoryTags";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatMonthDay, getLunarDateInfo } from "../../utils/date";
import {
  buildCalendarItemsForDateRange,
  buildCalendarMonthDays,
  groupCalendarItemsByDate,
  toCalendarDateKey
} from "../../utils/calendarItems";

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

export default function Calendar() {
  const navigate = useNavigate();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toCalendarDateKey(today));
  const [showLunar, setShowLunar] = useState(true);
  const todayKey = toCalendarDateKey(today);

  const monthDays = useMemo(() => buildCalendarMonthDays(cursor), [cursor]);
  const calendarRange = useMemo(
    () => ({
      start: monthDays[0]?.dateKey || toCalendarDateKey(cursor),
      end: monthDays[monthDays.length - 1]?.dateKey || toCalendarDateKey(cursor)
    }),
    [cursor, monthDays]
  );
  const items = useMemo(() => buildCalendarItemsForDateRange(calendarRange.start, calendarRange.end, state, getPersonName, getPlaceName), [
    calendarRange.end,
    calendarRange.start,
    getPersonName,
    getPlaceName,
    state
  ]);
  const itemsByDate = useMemo(() => groupCalendarItemsByDate(items), [items]);
  const selectedItems = itemsByDate[selectedDate] || [];
  const selectedLunar = getLunarDateInfo(selectedDate);

  function moveMonth(offset: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelectedDate(toCalendarDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  function backToToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toCalendarDateKey(now));
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
                  {item.mood || item.tagItems?.length ? (
                    <div className="memory-tags-line calendar-memory-tags">
                      <MemoryTags mood={item.mood} tags={item.tagItems || []} />
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
