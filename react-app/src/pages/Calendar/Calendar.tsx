import { CalendarDays, ChevronLeft, ChevronRight, Heart, PenLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryTags from "../../components/MemoryTags";
import PageSegmentNav from "../../components/PageSegmentNav";
import { useLifeLog } from "../../context/LifeLogContext";
import type { MemoryEvent } from "../../types";
import { formatMonthDay, getLunarDateInfo } from "../../utils/date";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import {
  buildCalendarItemsForDateRange,
  buildCalendarMonthDays,
  type CalendarItem,
  groupCalendarItemsByDate,
  toCalendarDateKey
} from "../../utils/calendarItems";

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

export default function Calendar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, getPersonName, getPlaceName } = useLifeLog();
  const today = new Date();
  const todayKey = toCalendarDateKey(today);
  const selectedDateParam = searchParams.get("date");
  const initialSelectedDate = normalizeDateKey(selectedDateParam) || todayKey;
  const [cursor, setCursor] = useState(() => monthCursorFromDateKey(initialSelectedDate) || new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDateState] = useState(initialSelectedDate);
  const [addingMemory, setAddingMemory] = useState(false);
  const [showLunar, setShowLunar] = useState(true);

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
  const selectedRelative = getRelativeDateInfo(selectedDate, todayKey);
  const selectedOverview = buildSelectedDateOverview({
    selectedDate,
    selectedItems,
    memories: state.memories,
    getPersonName,
    getPlaceName,
    selectedLunar,
    selectedRelative
  });
  const actionCopy = getCalendarActionCopy(selectedRelative.tone);
  const firstEntryItem = selectedItems.find((item) => item.type === "memory" || item.type === "plan");
  const firstAnniversaryItem = selectedItems.find((item) => item.type === "person");

  useEffect(() => {
    const nextDate = normalizeDateKey(selectedDateParam);
    if (!nextDate) return;
    setSelectedDateState(nextDate);
    setCursor((current) => isSameCalendarMonth(current, nextDate) ? current : monthCursorFromDateKey(nextDate) || current);
  }, [selectedDateParam]);

  function setSelectedDate(dateKey: string) {
    setSelectedDateState(dateKey);
    if (!isSameCalendarMonth(cursor, dateKey)) {
      const nextCursor = monthCursorFromDateKey(dateKey);
      if (nextCursor) setCursor(nextCursor);
    }
    setSearchParams({ date: dateKey }, { replace: true });
  }

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
      <PageSegmentNav
        ariaLabel="记录视图"
        items={[
          { to: "/memories", label: "时间线", icon: <Heart />, end: true },
          { to: "/calendar", label: "日历", icon: <CalendarDays /> }
        ]}
      />
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
        <GlassCard className="calendar-day-detail-card">
          <div className="calendar-day-detail-head">
            <span className="calendar-day-detail-icon">
              <CalendarDays />
            </span>
            <div>
              <strong>{formatMonthDay(selectedDate)} · {selectedRelative.label}</strong>
              <small>{selectedOverview.dateLine}</small>
            </div>
            <button type="button" onClick={() => setAddingMemory(true)}>
              <PenLine />
              {actionCopy.shortLabel}
            </button>
          </div>
          <div className="calendar-day-metrics">
            <span>
              <strong>{selectedOverview.planCount}</strong>
              计划
            </span>
            <span>
              <strong>{selectedOverview.memoryCount}</strong>
              回忆
            </span>
            <span>
              <strong>{selectedOverview.anniversaryCount}</strong>
              日子
            </span>
            <span>
              <strong>{selectedOverview.personNames.length}</strong>
              人物
            </span>
            <span>
              <strong>{selectedOverview.placeNames.length}</strong>
              地点
            </span>
          </div>
          <div className="calendar-day-brief">
            <strong>{selectedOverview.title}</strong>
            <span>{selectedOverview.desc}</span>
          </div>
          {selectedOverview.chips.length > 0 && (
            <div className="calendar-day-chips">
              {selectedOverview.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          )}
          <div className="calendar-day-actions">
            <button type="button" className="primary" onClick={() => setAddingMemory(true)}>
              <PenLine />
              {actionCopy.primaryLabel}
            </button>
            {firstEntryItem && (
              <button type="button" onClick={() => navigate(firstEntryItem.target)}>
                <Heart />
                {firstEntryItem.type === "plan" ? "打开计划" : "打开回忆"}
              </button>
            )}
            {firstAnniversaryItem && (
              <button type="button" onClick={() => navigate(firstAnniversaryItem.target)}>
                <CalendarDays />
                查看日子
              </button>
            )}
          </div>
        </GlassCard>
      </section>

      {selectedItems.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div className="calendar-selected-title">
              <h2>当天内容</h2>
              <span className={`calendar-relative-pill ${selectedRelative.tone}`}>{selectedItems.length} 条</span>
            </div>
            <button className="see-all" onClick={() => setAddingMemory(true)}>
              {actionCopy.shortLabel}
            </button>
          </div>
          <div className="list">
            {selectedItems.map((item) => (
              <button className="calendar-item glass-card" key={item.id} onClick={() => navigate(item.target)}>
                <div className="calendar-item-head">
                  <strong>{item.title}</strong>
                  <span className={`calendar-item-type ${item.type}`}>{getCalendarItemTypeLabel(item.type)}</span>
                </div>
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
          </div>
        </section>
      )}
      <EntrySheet
        type={addingMemory ? "memory" : null}
        memoryMode="quick"
        initialDate={selectedDate}
        onClose={() => setAddingMemory(false)}
      />
    </>
  );
}

interface SelectedDateOverview {
  planCount: number;
  memoryCount: number;
  anniversaryCount: number;
  personNames: string[];
  placeNames: string[];
  chips: string[];
  title: string;
  desc: string;
  dateLine: string;
}

function buildSelectedDateOverview({
  selectedDate,
  selectedItems,
  memories,
  getPersonName,
  getPlaceName,
  selectedLunar,
  selectedRelative
}: {
  selectedDate: string;
  selectedItems: CalendarItem[];
  memories: MemoryEvent[];
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  selectedLunar: ReturnType<typeof getLunarDateInfo>;
  selectedRelative: ReturnType<typeof getRelativeDateInfo>;
}): SelectedDateOverview {
  const dayMemories = memories.filter((memory) => memory.date === selectedDate);
  const memoryCount = selectedItems.filter((item) => item.type === "memory").length;
  const planCount = selectedItems.filter((item) => item.type === "plan").length;
  const anniversaryCount = selectedItems.filter((item) => item.type === "person").length;
  const personNames = uniqueLabels(dayMemories.flatMap((memory) => memory.personIds || []).map(getPersonName), "未关联人物");
  const placeNames = uniqueLabels(dayMemories.flatMap(getMemoryPlaceIds).map(getPlaceName), "未关联地点");
  const chips = [
    ...personNames.slice(0, 3).map((name) => `人物 · ${name}`),
    ...placeNames.slice(0, 3).map((name) => `地点 · ${name}`)
  ];
  const dateLine = selectedLunar
    ? `${selectedLunar.ganZhiZodiacText} · ${selectedLunar.weekText} ${selectedLunar.weekOfYearText} · ${selectedLunar.lunarText}`
    : "农历转换不可用";

  if (planCount || memoryCount || anniversaryCount) {
    const context = buildSelectedDateContext(personNames, placeNames);
    return {
      planCount,
      memoryCount,
      anniversaryCount,
      personNames,
      placeNames,
      chips,
      dateLine,
      title: buildSelectedDateTitle(planCount, memoryCount, anniversaryCount),
      desc: context || buildSelectedDateDesc(planCount, memoryCount, anniversaryCount, selectedRelative.tone)
    };
  }

  return {
    planCount,
    memoryCount,
    anniversaryCount,
    personNames,
    placeNames,
    chips,
    dateLine,
    title: selectedRelative.tone === "future" ? "这一天还没有安排" : "这一天还没有记录",
    desc: selectedRelative.emptyHint
  };
}

function buildSelectedDateTitle(planCount: number, memoryCount: number, anniversaryCount: number) {
  const parts = [
    planCount ? `${planCount} 个计划` : "",
    memoryCount ? `${memoryCount} 条回忆` : "",
    anniversaryCount ? `${anniversaryCount} 个日子` : ""
  ].filter(Boolean);
  return `${parts.join("、")}在这一天`;
}

function buildSelectedDateDesc(
  planCount: number,
  memoryCount: number,
  anniversaryCount: number,
  tone: ReturnType<typeof getRelativeDateInfo>["tone"]
) {
  if (planCount && tone === "future") return "可以打开计划查看准备事项，之后再补充当天实际发生的回忆。";
  if (planCount) return "可以打开安排补充实际发生的事，或继续补记当天细节。";
  if (memoryCount) return tone === "future"
    ? "可以提前记录这一天的安排，之后再补充实际发生的事。"
    : "可以打开回忆查看细节，或继续补记当时发生的事。";
  if (anniversaryCount) return tone === "future"
    ? "可以查看人物详情里的纪念日和安排，也可以提前记录这一天的计划。"
    : "可以查看人物详情里的纪念日和安排，也可以补记当天发生的事。";
  return "";
}

function getCalendarItemTypeLabel(type: CalendarItem["type"]) {
  if (type === "plan") return "计划";
  if (type === "memory") return "回忆";
  return "日子";
}

function getCalendarActionCopy(tone: ReturnType<typeof getRelativeDateInfo>["tone"]) {
  if (tone === "future") {
    return {
      shortLabel: "安排",
      primaryLabel: "安排这一天"
    };
  }
  if (tone === "today") {
    return {
      shortLabel: "记录",
      primaryLabel: "记录今天"
    };
  }
  return {
    shortLabel: "补记",
    primaryLabel: "补记这一天"
  };
}

function buildSelectedDateContext(personNames: string[], placeNames: string[]) {
  const people = personNames.length ? `人物：${personNames.slice(0, 3).join("、")}` : "";
  const places = placeNames.length ? `地点：${placeNames.slice(0, 3).join("、")}` : "";
  return [people, places].filter(Boolean).join(" · ");
}

function uniqueLabels(labels: string[], emptyLabel: string) {
  return Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter((label) => label && label !== emptyLabel)
    )
  );
}

function getRelativeDateInfo(dateKey: string, todayKey: string) {
  const delta = diffCalendarDays(dateKey, todayKey);
  if (delta === 0) {
    return {
      label: "今天",
      emptyHint: "今天还没有记录，可以先留下一件小事。",
      tone: "today"
    };
  }

  if (delta > 0) {
    return {
      label: `${delta} 天后`,
      emptyHint: `距离今天 ${delta} 天后，可以先记下计划或想做的事。`,
      tone: "future"
    };
  }

  const daysAgo = Math.abs(delta);
  return {
    label: `${daysAgo} 天前`,
    emptyHint: `这是 ${daysAgo} 天前，可以补上当时发生的事。`,
    tone: "past"
  };
}

function diffCalendarDays(targetDateKey: string, baseDateKey: string) {
  return Math.round((dateKeyToUtcTime(targetDateKey) - dateKeyToUtcTime(baseDateKey)) / 86400000);
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day);
}

function normalizeDateKey(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return toCalendarDateKey(date);
}

function monthCursorFromDateKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function isSameCalendarMonth(cursor: Date, dateKey: string) {
  const next = monthCursorFromDateKey(dateKey);
  if (!next) return true;
  return cursor.getFullYear() === next.getFullYear() && cursor.getMonth() === next.getMonth();
}
