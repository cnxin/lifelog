import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import {
  Cake,
  ChevronLeft,
  ChevronRight,
  Heart,
  Hourglass,
  Plus,
} from "lucide-react";
import Modal from "./Modal";
import { categories, type Day } from "./domain";
import {
  MAX_CALENDAR_DATE,
  MIN_CALENDAR_DATE,
  calendarDateInfo,
  monthCells,
  monthOccurrences,
  shiftDate,
  shiftMonth,
} from "./calendar";

const week = ["一", "二", "三", "四", "五", "六", "日"];
const tones = { 纪念日: "rose", 生日: "amber", 倒数日: "sage" };
const icons = { 纪念日: Heart, 生日: Cake, 倒数日: Hourglass };
function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export default function CalendarView({
  days,
  today,
  selectedDate,
  onSelect,
  onClose,
  onAdd,
  onEdit,
}: {
  days: Day[];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  onAdd: (date: string) => void;
  onEdit: (day: Day) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const keyboardFocus = useRef(true);
  const month = selectedDate.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const cells = useMemo(() => monthCells(month), [month]);
  const occurrences = useMemo(
    () => monthOccurrences(days, month),
    [days, month],
  );
  const dates = useMemo(
    () =>
      new Map(
        cells
          .filter((date): date is string => date !== null)
          .map((date) => [date, calendarDateInfo(date)]),
      ),
    [cells],
  );
  const selectedInfo = dates.get(selectedDate)!;
  const total = [...occurrences.values()].reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  const selected = occurrences.get(selectedDate) || [];
  useEffect(() => {
    if (!keyboardFocus.current) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[data-selected="true"]')
      ?.focus();
    keyboardFocus.current = false;
  }, [selectedDate]);
  function select(date: string) {
    if (date >= MIN_CALENDAR_DATE && date <= MAX_CALENDAR_DATE) onSelect(date);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const targets: Record<string, () => string> = {
      ArrowLeft: () => shiftDate(date, -1),
      ArrowRight: () => shiftDate(date, 1),
      ArrowUp: () => shiftDate(date, -7),
      ArrowDown: () => shiftDate(date, 7),
      Home: () => shiftDate(date, -weekday),
      End: () => shiftDate(date, 6 - weekday),
      PageUp: () => shiftMonth(date, event.shiftKey ? -12 : -1),
      PageDown: () => shiftMonth(date, event.shiftKey ? 12 : 1),
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    keyboardFocus.current = true;
    select(target());
  }
  return (
    <Modal title="日历" onClose={onClose} className="calendar-modal">
      <div className="calendar-content" ref={root}>
        <div className="calendar-navigation">
          <div>
            <h3 id="calendar-month" aria-live="polite">
              {year}年 <span>{monthNumber}月</span>
            </h3>
            <p className="calendar-summary">
              本月 {total} 个日子 · {occurrences.size} 天有记录
            </p>
          </div>
          <div className="calendar-month-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="上个月"
              disabled={month === "1901-01"}
              onClick={() => select(shiftMonth(selectedDate, -1))}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="calendar-today"
              onClick={() => select(today)}
            >
              今天
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="下个月"
              disabled={month === "2099-12"}
              onClick={() => select(shiftMonth(selectedDate, 1))}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="calendar-scroll">
          <table
            className="calendar-grid"
            role="grid"
            aria-labelledby="calendar-month"
            aria-describedby="calendar-keyboard-help"
          >
            <thead>
              <tr>
                {week.map((day) => (
                  <th key={day} scope="col">
                    <span aria-label={`星期${day}`}>{day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, row) => (
                <tr key={row}>
                  {cells.slice(row * 7, row * 7 + 7).map((date, column) => {
                    if (!date) return <td key={`empty-${column}`} />;
                    const entries = occurrences.get(date) || [];
                    const info = dates.get(date)!;
                    return (
                      <td key={date} aria-selected={date === selectedDate}>
                        <button
                          type="button"
                          className="calendar-day"
                          data-selected={date === selectedDate}
                          data-today={date === today}
                          tabIndex={date === selectedDate ? 0 : -1}
                          aria-current={date === today ? "date" : undefined}
                          aria-label={`${dateLabel(date)}，${info.lunar}${info.festivals.length || info.term ? "，" + [...info.festivals, info.term].filter(Boolean).join("、") : ""}${date === today ? "，今天" : ""}，${entries.length ? `${entries.length}个日子：${entries.map((day) => day.title).join("、")}` : "暂无记录"}`}
                          onClick={() => select(date)}
                          onKeyDown={(event) => navigate(event, date)}
                        >
                          <span className="calendar-number">
                            {Number(date.slice(8))}
                          </span>
                          <span
                            className="calendar-lunar"
                            data-special={
                              !!(info.festivals.length || info.term)
                            }
                          >
                            {info.cellText}
                          </span>
                          <span className="calendar-dots" aria-hidden="true">
                            {categories
                              .filter((category) =>
                                entries.some(
                                  (day) => day.category === category,
                                ),
                              )
                              .map((category) => (
                                <i key={category} className={tones[category]} />
                              ))}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sr-only" id="calendar-keyboard-help">
          方向键切换日期，Home 和 End 切换到周首和周末，Page Up 和 Page Down
          切换月份，按住 Shift 切换年份。
        </p>
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
                      aria-label={`编辑：${day.title}`}
                      onClick={() => onEdit(day)}
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
