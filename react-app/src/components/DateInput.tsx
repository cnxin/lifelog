import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatLunarDate, getLunarDateInfo } from "../utils/date";

interface DateInputProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  label: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
const wheelItemHeight = 36;
const yearOptions = Array.from({ length: 201 }, (_, index) => 1900 + index);
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

export default function DateInput({ name, value, defaultValue = "", label, required = false, onChange }: DateInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [showLunar, setShowLunar] = useState(false);
  const selectedValue = isControlled ? value : internalValue;
  const [draftValue, setDraftValue] = useState(selectedValue || todayValue());
  const [viewYear, viewMonth] = useMemo(() => parseDateParts(draftValue), [draftValue]);
  const [pendingYear, setPendingYear] = useState(viewYear);
  const [pendingMonth, setPendingMonth] = useState(viewMonth);
  const yearWheelRef = useRef<HTMLDivElement | null>(null);
  const monthWheelRef = useRef<HTMLDivElement | null>(null);
  const scrollTimersRef = useRef<{ year?: number; month?: number }>({});
  const latestPendingRef = useRef({ year: pendingYear, month: pendingMonth });
  const calendarDays = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewMonth, viewYear]);
  const hasPendingYearMonth = pendingYear !== viewYear || pendingMonth !== viewMonth;

  useEffect(() => {
    latestPendingRef.current = { year: pendingYear, month: pendingMonth };
  }, [pendingMonth, pendingYear]);

  useEffect(() => {
    if (!isOpen) return;
    scrollWheelToValue(yearWheelRef.current, pendingYear - 1900);
    scrollWheelToValue(monthWheelRef.current, pendingMonth - 1);
  }, [isOpen, pendingMonth, pendingYear]);

  function handleWheelScroll(type: "year" | "month", element: HTMLDivElement) {
    window.clearTimeout(scrollTimersRef.current[type]);
    scrollTimersRef.current[type] = window.setTimeout(() => {
      const index = Math.round(element.scrollTop / wheelItemHeight);
      if (type === "year") {
        const clampedIndex = clamp(index, 0, yearOptions.length - 1);
        const nextYear = 1900 + clampedIndex;
        setPendingYear(nextYear);
        applyPendingYearMonth(nextYear, latestPendingRef.current.month);
        scrollWheelToValue(element, clampedIndex);
      } else {
        const clampedIndex = clamp(index, 0, monthOptions.length - 1);
        const nextMonth = clampedIndex + 1;
        setPendingMonth(nextMonth);
        applyPendingYearMonth(latestPendingRef.current.year, nextMonth);
        scrollWheelToValue(element, clampedIndex);
      }
    }, 90);
  }

  function scrollWheelToValue(element: HTMLDivElement | null, index: number) {
    if (!element) return;
    element.scrollTo({ top: index * wheelItemHeight, behavior: "smooth" });
  }

  function openPanel() {
    const nextValue = selectedValue || todayValue();
    const [nextYear, nextMonth] = parseDateParts(nextValue);
    setDraftValue(nextValue);
    setPendingYear(nextYear);
    setPendingMonth(nextMonth);
    setIsOpen(true);
  }

  function confirmDate() {
    if (!isControlled) setInternalValue(draftValue);
    onChange?.(draftValue);
    setIsOpen(false);
  }

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth - 1 + offset, 1);
    setDateParts(next.getFullYear(), next.getMonth() + 1);
    setPendingYear(next.getFullYear());
    setPendingMonth(next.getMonth() + 1);
  }

  function setDateParts(year: number, month: number) {
    const [, , draftDay] = parseDateParts(draftValue);
    const normalizedYear = Math.min(Math.max(year, 1900), 2100);
    const normalizedMonth = Math.min(Math.max(month, 1), 12);
    const maxDay = new Date(normalizedYear, normalizedMonth, 0).getDate();
    setDraftValue(formatDateValue(normalizedYear, normalizedMonth, Math.min(draftDay, maxDay)));
  }

  function applyPendingYearMonth(year = pendingYear, month = pendingMonth) {
    setDateParts(year, month);
  }

  function selectToday() {
    const today = todayValue();
    const [todayYear, todayMonth] = parseDateParts(today);
    setDraftValue(today);
    setPendingYear(todayYear);
    setPendingMonth(todayMonth);
  }

  const panel = isOpen ? (
    <>
      <button className="date-input-backdrop" type="button" aria-label="关闭日期选择器" onClick={() => setIsOpen(false)} />
      <div className="date-input-panel date-calendar-panel" role="dialog" aria-label={label}>
        <div className="date-calendar-head">
          <button type="button" aria-label="上个月" onClick={() => moveMonth(-1)}>
            <ChevronLeft />
          </button>
          <div className="date-calendar-title">
            <strong>{viewYear}年 {String(viewMonth).padStart(2, "0")}月</strong>
            {hasPendingYearMonth && (
              <span>松手后自动切换到 {pendingYear}年 {String(pendingMonth).padStart(2, "0")}月</span>
            )}
          </div>
          <button type="button" aria-label="下个月" onClick={() => moveMonth(1)}>
            <ChevronRight />
          </button>
        </div>
        <div className="date-wheel-picker" aria-label="年月滚轮选择">
          <div
            className="date-wheel-column"
            aria-label="年份"
            ref={yearWheelRef}
            onScroll={(event) => handleWheelScroll("year", event.currentTarget)}
          >
            <div className="date-wheel-spacer" />
            {yearOptions.map((year) => (
              <button
                className={year === pendingYear ? "active" : ""}
                type="button"
                key={year}
                onClick={() => {
                  setPendingYear(year);
                  applyPendingYearMonth(year, pendingMonth);
                }}
              >
                {year}年
              </button>
            ))}
            <div className="date-wheel-spacer" />
          </div>
          <div
            className="date-wheel-column"
            aria-label="月份"
            ref={monthWheelRef}
            onScroll={(event) => handleWheelScroll("month", event.currentTarget)}
          >
            <div className="date-wheel-spacer" />
            {monthOptions.map((month) => (
              <button
                className={month === pendingMonth ? "active" : ""}
                type="button"
                key={month}
                onClick={() => {
                  setPendingMonth(month);
                  applyPendingYearMonth(pendingYear, month);
                }}
              >
                {String(month).padStart(2, "0")}月
              </button>
            ))}
            <div className="date-wheel-spacer" />
          </div>
          <div className="date-wheel-highlight" />
        </div>
        <div className="date-wheel-actions">
          <button className="date-today-button" type="button" onClick={selectToday}>回到今天</button>
          <span className="date-auto-apply-note">年月会自动应用</span>
        </div>
        <button
          className={`date-lunar-toggle ${showLunar ? "active" : ""}`}
          type="button"
          onClick={() => setShowLunar((current) => !current)}
        >
          {showLunar ? "隐藏农历" : "显示农历"}
        </button>
        {showLunar && <LunarDateSummary date={draftValue} />}
        <div className="date-calendar-weekdays">
          {weekDays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className={`date-calendar-grid ${showLunar ? "with-lunar" : ""}`}>
          {calendarDays.map((day, index) =>
            day ? (
              <button
                className={day.value === draftValue ? "active" : ""}
                type="button"
                key={day.value}
                onClick={() => setDraftValue(day.value)}
              >
                <span>{day.label}</span>
                {showLunar && <small>{formatLunarDay(day.value)}</small>}
              </button>
            ) : (
              <span key={`blank-${index}`} />
            )
          )}
        </div>
        <div className="date-calendar-actions">
          <button type="button" className="ghost-btn" onClick={() => setIsOpen(false)}>
            取消
          </button>
          <button type="button" className="primary-btn" onClick={confirmDate}>
            确定
          </button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="date-input">
      {name && <input type="hidden" name={name} value={selectedValue} required={required} />}
      <button
        className="date-input-trigger"
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={openPanel}
      >
        <CalendarDays />
        <span className={selectedValue ? "" : "placeholder"}>{selectedValue || "选择日期"}</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateParts(value: string) {
  const [rawYear, rawMonth, rawDay] = (value || todayValue()).split("-");
  const year = Number(rawYear) || new Date().getFullYear();
  const month = Math.min(Math.max(Number(rawMonth) || 1, 1), 12);
  const maxDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(Number(rawDay) || 1, 1), maxDay);
  return [year, month, day] as const;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const dayCount = new Date(year, month, 0).getDate();
  const blanks = Array.from<null>({ length: startOffset }).fill(null);
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    return {
      label: String(day),
      value: formatDateValue(year, month, day)
    };
  });
  return [...blanks, ...days];
}

function LunarDateSummary({ date }: { date: string }) {
  const info = getLunarDateInfo(date);
  if (!info) return <div className="date-lunar-current">当前选中：{formatLunarDate(date)}</div>;

  return (
    <div className="date-lunar-current">
      <strong>{info.fullText}</strong>
      <span>{[info.lunarText, info.jieQi, ...info.festivals].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

function formatLunarDay(date: string) {
  return getLunarDateInfo(date)?.cellText || formatLunarDate(date).replace(/^农历/, "").replace(/^.*年/, "");
}

function formatDateValue(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
