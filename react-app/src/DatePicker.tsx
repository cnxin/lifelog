import { useEffect, useId, useRef, useState } from "react";
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
  shiftMonth,
} from "./calendar";
import { todayKey } from "./domain";
import { haptic } from "./haptics";
import MonthGrid, { calendarKeyboardHelp, dateLabel } from "./MonthGrid";
import MonthPicker from "./MonthPicker";
import useMonthSwipe from "./useMonthSwipe";
import SegmentedControl from "./SegmentedControl";
import LunarGrid from "./LunarGrid";

function scrollDateField(field: HTMLDivElement) {
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto' : 'smooth';
  const scroller = field.closest<HTMLElement>('.modal-body');
  const ancestors: { el: HTMLElement; top: number; left: number }[] = [];
  for (let el = field.parentElement; el; el = el.parentElement)
    ancestors.push({ el, top: el.scrollTop, left: el.scrollLeft });
  const fallbackTop = scroller
    ? scroller.scrollTop + field.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top - scroller.clientTop -
      (parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0) -
      (parseFloat(getComputedStyle(field).scrollMarginTop) || 0)
    : 0;
  let supportsContainer = false;
  const options: ScrollIntoViewOptions & { readonly container: 'nearest' } = {
    block: 'start', behavior,
    // WebIDL reads recognized dictionary members; older engines ignore this.
    get container() { supportsContainer = true; return 'nearest' as const; },
  };
  field.scrollIntoView(options);
  if (!supportsContainer && scroller) {
    // Cancel ancestor scrolling in old WebViews, including the overflow-hidden
    // dialog, then animate only its body using the same padding/margin geometry.
    for (const { el, top, left } of ancestors) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
    scroller.scrollTo({ top: fallbackTop, behavior });
  }
}

export default function DatePicker({
  value,
  onChange,
  open,
  onOpenChange,
  calendar,
}: {
  value: string;
  onChange: (date: string, calendar?: "lunar") => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: "solar" | "lunar";
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusDay = useRef(false);
  const wasOpen = useRef(false);
  const [cursor, setCursor] = useState(value);
  const [chooseMonth, setChooseMonth] = useState(false);
  const [mode, setMode] = useState<"solar" | "lunar">(calendar);
  const month = cursor.slice(0, 7);
  const previousLayout = useRef({ month, chooseMonth, mode });
  const info = calendarDateInfo(value);
  const today = todayKey();
  const swipe = useMonthSwipe((direction) =>
    move(shiftMonth(cursor, direction)),
  );
  useEffect(() => {
    const keyboardNavigation = focusDay.current && wasOpen.current;
    if (open && focusDay.current && !chooseMonth) {
      panel.current
        ?.querySelector<HTMLButtonElement>(mode === "lunar" ? '.lunar-day[tabindex="0"]' : '.calendar-day[tabindex="0"]')
        ?.focus({ preventScroll: !wasOpen.current });
      focusDay.current = false;
    }
    // A quick month/menu click can interrupt the opening scroll with native
    // focus scrolling. Re-align the whole field after that layout change;
    // keyboard day navigation still gets its own focused-day scrolling.
    const layoutChanged = previousLayout.current.month !== month ||
      previousLayout.current.chooseMonth !== chooseMonth || previousLayout.current.mode !== mode;
    if (open && field.current &&
      (!wasOpen.current || (layoutChanged && !keyboardNavigation)))
      scrollDateField(field.current);
    if (!open && wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
    previousLayout.current = { month, chooseMonth, mode };
  }, [open, cursor, chooseMonth, mode]);
  function move(date: string, focus = false) {
    const bounded =
      date < MIN_CALENDAR_DATE
        ? MIN_CALENDAR_DATE
        : date > MAX_CALENDAR_DATE
          ? MAX_CALENDAR_DATE
          : date;
    focusDay.current = focus;
    if (bounded.slice(0, 7) !== month)
      swipe.animate(bounded.slice(0, 7) < month ? -1 : 1);
    setCursor(bounded);
  }
  function select(date: string) {
    void haptic("light");
    onChange(date, mode === "lunar" ? "lunar" : undefined);
    onOpenChange(false);
  }
  return (
    <div className={open ? "date-field date-field-open" : "date-field"} ref={field}>
      <span className="date-field-label" id={id + "-label"}>
        日期
      </span>
      <button
        type="button"
        ref={trigger}
        className="date-trigger"
        aria-labelledby={id + "-label " + id + "-value"}
        aria-describedby="date-help"
        aria-expanded={open}
        aria-controls={open ? id + "-panel" : undefined}
        data-date={value}
        onClick={() => {
          if (!open) {
            setCursor(value);
            setChooseMonth(false);
            setMode(calendar);
            swipe.clearSlide();
            focusDay.current = true;
          }
          onOpenChange(!open);
        }}
      >
        <CalendarDays size={21} aria-hidden="true" />
        <span className="date-trigger-copy">
          <strong id={id + "-value"}>{dateLabel(value)}</strong>
          <small>
            {info.lunar} · {info.week.split(" · ")[0]}
          </small>
        </span>
        <ChevronDown size={18} className="date-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="date-picker"
          id={id + "-panel"}
          ref={panel}
          role="region"
          aria-label="选择日期"
        >
          <div className="date-picker-toolbar">
            <SegmentedControl label="日期录入历法" hideLabel className="date-calendar-mode"
              name={id + "-calendar-mode"} value={mode}
              options={[{ value: "solar", label: "公历" }, { value: "lunar", label: "农历" }]}
              onChange={next => { setMode(next); setChooseMonth(false); swipe.clearSlide(); }} />
            {mode === "solar" && <>
            <button
              type="button"
              className="date-month-heading"
              aria-label="切换年月"
              aria-expanded={chooseMonth}
              aria-controls={chooseMonth ? id + "-months" : undefined}
              onClick={() => setChooseMonth(!chooseMonth)}
            >
              <span aria-live="polite">
                {Number(month.slice(0, 4))}年 {Number(month.slice(5))}月
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
            </>}
          </div>
          {mode === "lunar" ? <LunarGrid selected={value} onSelect={select} id={id + "-lunar"} /> : chooseMonth ? (
            <MonthPicker
              month={month}
              id={id + "-months"}
              onSelect={(next) => {
                move(next + "-01", true);
                setChooseMonth(false);
              }}
            />
          ) : (
            <>
              <div className="calendar-scroll" {...swipe.handlers}>
                <MonthGrid
                  month={month}
                  selected={value}
                  cursor={cursor}
                  today={today}
                  onSelect={select}
                  onCursor={move}
                  describedBy={id + "-keyboard"}
                  slide={swipe.slide}
                  onSlideEnd={swipe.clearSlide}
                />
              </div>
              <p className="sr-only" id={id + "-keyboard"}>
                {calendarKeyboardHelp}
              </p>
            </>
          )}
          <div className="date-picker-footer">
            <button
              type="button"
              className="calendar-today"
              onClick={() => select(today)}
            >
              今天
            </button>
            <span>{mode === "lunar" ? "按农历选日期 · 保存为对应公历" : "公历选日期 · 农历作参考"}</span>
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
