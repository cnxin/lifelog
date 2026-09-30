import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  calendarDateInfo,
  MAX_CALENDAR_DATE,
  MIN_CALENDAR_DATE,
  monthCells,
  shiftDate,
  shiftMonth,
} from "./calendar";
import { todayKey } from "./domain";
import { haptic } from "./haptics";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
export default function DatePicker({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (date: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusDay = useRef(false);
  const wasOpen = useRef(false);
  const [cursor, setCursor] = useState(value);
  const [chooseMonth, setChooseMonth] = useState(false);
  const [yearText, setYearText] = useState(value.slice(0, 4));
  const month = cursor.slice(0, 7);
  const cells = useMemo(() => monthCells(month), [month]);
  const info = calendarDateInfo(value);
  const today = todayKey();
  const year = Number(yearText);
  const validYear = /^\d{4}$/.test(yearText) && year >= 1901 && year <= 2099;
  const dateLabel = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return `${y}年${m}月${d}日`;
  };
  useEffect(() => {
    if (open && focusDay.current && !chooseMonth) {
      panel.current
        ?.querySelector<HTMLButtonElement>('[tabindex="0"]')
        ?.focus();
      focusDay.current = false;
    }
    if (open && !wasOpen.current) {
      panel.current?.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
    if (!open && wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open, cursor, chooseMonth]);
  function move(date: string, focus = false) {
    focusDay.current = focus;
    setCursor(
      date < MIN_CALENDAR_DATE
        ? MIN_CALENDAR_DATE
        : date > MAX_CALENDAR_DATE
          ? MAX_CALENDAR_DATE
          : date,
    );
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
    if (targets[event.key]) {
      event.preventDefault();
      move(targets[event.key](), true);
    }
  }
  function select(date: string) {
    void haptic("light");
    onChange(date);
    onOpenChange(false);
  }
  return (
    <div className="date-field">
      <span className="date-field-label" id={`${id}-label`}>
        日期
      </span>
      <button
        type="button"
        ref={trigger}
        className="date-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby="date-help"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        data-date={value}
        onClick={() => {
          if (!open) {
            setCursor(value);
            setYearText(value.slice(0, 4));
            setChooseMonth(false);
            focusDay.current = true;
          }
          onOpenChange(!open);
        }}
      >
        <CalendarDays size={21} aria-hidden="true" />
        <span className="date-trigger-copy">
          <strong id={`${id}-value`}>{dateLabel(value)}</strong>
          <small>
            {info.lunar} · {info.week.split(" · ")[0]}
          </small>
        </span>
        <ChevronDown size={18} className="date-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="date-picker"
          id={`${id}-panel`}
          ref={panel}
          role="region"
          aria-label="选择日期"
        >
          <div className="date-picker-toolbar">
            <button
              type="button"
              className="date-month-heading"
              aria-label="切换年月"
              aria-expanded={chooseMonth}
              aria-controls={chooseMonth ? `${id}-months` : undefined}
              onClick={() => {
                setYearText(cursor.slice(0, 4));
                setChooseMonth(!chooseMonth);
              }}
            >
              <span aria-live="polite">
                {Number(cursor.slice(0, 4))}年 {Number(cursor.slice(5, 7))}月
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div className="calendar-month-actions">
              {!chooseMonth && (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="上个月"
                    disabled={month === "1901-01"}
                    onClick={() => move(shiftMonth(cursor, -1))}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="下个月"
                    disabled={month === "2099-12"}
                    onClick={() => move(shiftMonth(cursor, 1))}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
          {chooseMonth ? (
            <div id={`${id}-months`}>
              <div className="date-year-row">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="前一年"
                  disabled={!validYear || year === 1901}
                  onClick={() => setYearText(String(year - 1))}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <label className="date-year-label">
                  年份
                  <input
                    aria-describedby={`${id}-year-help`}
                    aria-invalid={!validYear}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={yearText}
                    onChange={(event) => setYearText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="后一年"
                  disabled={!validYear || year === 2099}
                  onClick={() => setYearText(String(year + 1))}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="date-picker-hint" id={`${id}-year-help`}>
                {validYear
                  ? "可直接输入年份，再选择月份"
                  : "请输入 1901–2099 之间的四位年份"}
              </p>
              <div className="date-months" role="group" aria-label="月份">
                {Array.from({ length: 12 }, (_, index) => (
                  <button
                    type="button"
                    key={index}
                    disabled={!validYear}
                    aria-pressed={
                      year === Number(cursor.slice(0, 4)) &&
                      index + 1 === Number(cursor.slice(5, 7))
                    }
                    onClick={() => {
                      move(
                        `${yearText}-${String(index + 1).padStart(2, "0")}-01`,
                        true,
                      );
                      setChooseMonth(false);
                    }}
                  >
                    {index + 1}月
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="calendar-scroll">
                <table
                  className="calendar-grid"
                  role="grid"
                  aria-label={`${Number(cursor.slice(0, 4))}年${Number(cursor.slice(5, 7))}月，选择日期`}
                  aria-describedby={`${id}-keyboard`}
                >
                  <thead>
                    <tr>
                      {weekdays.map((day) => (
                        <th scope="col" key={day}>
                          <span aria-label={`星期${day}`}>{day}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, row) => (
                      <tr key={row}>
                        {cells.slice(row * 7, row * 7 + 7).map((date, col) => {
                          if (!date) return <td key={col} />;
                          const lunar = calendarDateInfo(date);
                          return (
                            <td key={date} aria-selected={date === value}>
                              <button
                                type="button"
                                className="calendar-day"
                                data-date={date}
                                data-selected={date === value}
                                data-today={date === today}
                                tabIndex={date === cursor ? 0 : -1}
                                aria-current={
                                  date === today ? "date" : undefined
                                }
                                aria-label={`${dateLabel(date)}，${lunar.lunar}${lunar.festivals.length || lunar.term ? "，" + [...lunar.festivals, lunar.term].filter(Boolean).join("、") : ""}${date === today ? "，今天" : ""}`}
                                onKeyDown={(event) => navigate(event, date)}
                                onClick={() => select(date)}
                              >
                                <span className="calendar-number">
                                  {Number(date.slice(8))}
                                </span>
                                <span
                                  className="calendar-lunar"
                                  data-special={
                                    !!(lunar.festivals.length || lunar.term)
                                  }
                                >
                                  {lunar.cellText}
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
              <p className="sr-only" id={`${id}-keyboard`}>
                方向键切换日期，Home 和 End 跳转周首和周末，Page Up 和 Page Down
                切换月份，按住 Shift 切换年份，回车确认，Escape 收起。
              </p>
            </>
          )}
          <div className="date-picker-footer">
            <button
              type="button"
              className="calendar-today"
              onClick={() => select(today)}
            >
              选择今天
            </button>
            <span>公历选日期 · 农历作参考</span>
            <button
              type="button"
              className="date-collapse"
              onClick={() => onOpenChange(false)}
            >
              收起
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
