import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Modal from "./Modal";
import { icons, tones } from "./dayMeta";
import { haptic } from "./haptics";
import { categories, type Day, type Category } from "./domain";
import {
  MAX_CALENDAR_DATE,
  MIN_CALENDAR_DATE,
  calendarDateInfo,
  monthOccurrences,
  shiftMonth,
} from "./calendar";
import MonthGrid, { calendarKeyboardHelp, dateLabel } from "./MonthGrid";
import MonthPicker from "./MonthPicker";
import useMonthSwipe from "./useMonthSwipe";

export default function CalendarView({
  days,
  today,
  selectedDate,
  onSelect,
  onClose,
  onAdd,
  onOpen,
}: {
  days: Day[];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  onAdd: (date: string) => void;
  onOpen: (day: Day) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const monthButton = useRef<HTMLButtonElement>(null);
  const keyboardFocus = useRef(true);
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const [cursor, setCursor] = useState(selectedDate);
  const [chooseMonth, setChooseMonth] = useState(false);
  const occurrences = useMemo(
    () => monthOccurrences(days, month),
    [days, month],
  );
  const agendaOccurrences = useMemo(
    () =>
      selectedDate.slice(0, 7) === month
        ? occurrences
        : monthOccurrences(days, selectedDate.slice(0, 7)),
    [days, month, occurrences, selectedDate],
  );
  const selectedInfo = useMemo(
    () => calendarDateInfo(selectedDate),
    [selectedDate],
  );
  const selected = agendaOccurrences.get(selectedDate) || [];
  const marks = useMemo(
    () =>
      new Map<string, Category[]>(
        Array.from(occurrences, ([date, entries]) => [
          date,
          categories.filter((category) =>
            entries.some((day) => day.category === category),
          ),
        ]),
      ),
    [occurrences],
  );
  const total = [...occurrences.values()].reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  const swipe = useMonthSwipe((direction) =>
    browse(shiftMonth(month + "-01", direction).slice(0, 7)),
  );
  useEffect(() => {
    if (!keyboardFocus.current || chooseMonth) return;
    root.current
      ?.querySelector<HTMLButtonElement>('.calendar-day[tabindex="0"]')
      ?.focus();
    keyboardFocus.current = false;
  }, [cursor, month, chooseMonth]);
  function browse(next: string, focus = false) {
    const bounded =
      next < MIN_CALENDAR_DATE.slice(0, 7)
        ? MIN_CALENDAR_DATE.slice(0, 7)
        : next > MAX_CALENDAR_DATE.slice(0, 7)
          ? MAX_CALENDAR_DATE.slice(0, 7)
          : next;
    if (bounded !== month) swipe.animate(bounded < month ? -1 : 1);
    keyboardFocus.current = focus;
    setMonth(bounded);
    setCursor(
      selectedDate.startsWith(bounded) ? selectedDate : bounded + "-01",
    );
  }
  function select(date: string, focus = false, feedback = false) {
    const bounded =
      date < MIN_CALENDAR_DATE
        ? MIN_CALENDAR_DATE
        : date > MAX_CALENDAR_DATE
          ? MAX_CALENDAR_DATE
          : date;
    if (feedback) void haptic("light");
    keyboardFocus.current = focus;
    if (bounded.slice(0, 7) !== month)
      swipe.animate(bounded.slice(0, 7) < month ? -1 : 1);
    setMonth(bounded.slice(0, 7));
    setCursor(bounded);
    onSelect(bounded);
  }
  return (
    <Modal
      title="日历"
      onClose={onClose}
      onCancel={
        chooseMonth
          ? () => {
              setChooseMonth(false);
              monthButton.current?.focus();
            }
          : undefined
      }
      className="calendar-modal"
    >
      <div className="calendar-content" ref={root}>
        <div className="calendar-navigation">
          <div>
            <h3 id="calendar-month">
              <button
                ref={monthButton}
                type="button"
                className="date-month-heading"
                aria-label="切换年月"
                aria-expanded={chooseMonth}
                aria-controls={chooseMonth ? "calendar-months" : undefined}
                onClick={() => setChooseMonth(!chooseMonth)}
              >
                <span aria-live="polite">
                  {Number(month.slice(0, 4))}年 {Number(month.slice(5))}月
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </h3>
            <p className="calendar-summary">
              本月 {total} 个日子 · {occurrences.size} 天有记录
            </p>
          </div>
          <div className="calendar-month-actions">
            {!chooseMonth && (
              <button
                type="button"
                className="icon-button"
                aria-label="上个月"
                disabled={month === "1901-01"}
                onClick={() =>
                  browse(shiftMonth(month + "-01", -1).slice(0, 7))
                }
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="calendar-today"
              onClick={() => {
                setChooseMonth(false);
                select(today, false, true);
              }}
            >
              今天
            </button>
            {!chooseMonth && (
              <button
                type="button"
                className="icon-button"
                aria-label="下个月"
                disabled={month === "2099-12"}
                onClick={() => browse(shiftMonth(month + "-01", 1).slice(0, 7))}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {chooseMonth ? (
          <MonthPicker
            month={month}
            id="calendar-months"
            onSelect={(next) => {
              browse(next, true);
              setChooseMonth(false);
            }}
          />
        ) : (
          <>
            <div className="calendar-scroll" {...swipe.handlers}>
              <MonthGrid
                month={month}
                selected={selectedDate}
                cursor={cursor}
                today={today}
                marks={marks}
                extraLabel={(date) => {
                  const entries = occurrences.get(date) || [];
                  return entries.length
                    ? entries.length +
                        "个日子：" +
                        entries.map((day) => day.title).join("、")
                    : "暂无记录";
                }}
                onSelect={(date) => select(date, false, true)}
                onCursor={(date, focus) => select(date, focus)}
                describedBy="calendar-keyboard-help"
                slide={swipe.slide}
                onSlideEnd={swipe.clearSlide}
              />
            </div>
            <p className="sr-only" id="calendar-keyboard-help">
              {calendarKeyboardHelp}
            </p>
          </>
        )}
        <div className="calendar-legend" aria-label="日历标记">
          {categories.map((category) => (
            <span key={category}>
              <i className={tones[category]} aria-hidden="true" />
              {category}
            </span>
          ))}
          <span className="calendar-today-legend">描边为今天</span>
        </div>
        <section
          className="calendar-agenda"
          aria-labelledby="calendar-selected-title"
        >
          <div className="calendar-agenda-heading">
            <div>
              <h3 id="calendar-selected-title">
                {dateLabel(selectedDate)}
                {selectedDate === today && <span>今天</span>}
              </h3>
              <p>
                {selectedInfo.lunar} · {selectedInfo.week}
              </p>
            </div>
            <button
              type="button"
              className="secondary calendar-add"
              aria-label="在所选日期新增日子"
              onClick={() => onAdd(selectedDate)}
            >
              <Plus size={17} aria-hidden="true" />
              <span>记一笔</span>
            </button>
          </div>
          <div className="calendar-date-details">
            <p>{selectedInfo.ganZhi}</p>
            {(selectedInfo.festivals.length > 0 || selectedInfo.term) && (
              <p className="calendar-festivals">
                {[...selectedInfo.festivals, selectedInfo.term]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {selected.length ? (
            <ul className="calendar-events">
              {selected.map((day) => {
                const Icon = icons[day.category];
                return (
                  <li key={day.id}>
                    <button
                      type="button"
                      className={`calendar-event ${tones[day.category]}`}
                      aria-label={`查看：${day.title}`}
                      onClick={() => onOpen(day)}
                    >
                      <span
                        className={`calendar-event-icon ${tones[day.category]}`}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="calendar-event-copy">
                        <strong>{day.title}</strong>
                        <small>
                          {day.category}
                          {day.repeat === "yearly"
                            ? ` · 每年${day.calendar === "lunar" ? "农历" : "公历"}重复`
                            : " · 不重复"}
                          {day.pinned ? " · 已置顶" : ""}
                        </small>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="calendar-empty">
              <p>这一天，留给新的美好。</p>
              <span>还没有记录，可以记下一个特别的日子。</span>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
