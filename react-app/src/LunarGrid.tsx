import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import DateYearRow from "./DateYearRow";
import { lunarCursor, lunarDays, lunarMonths, validLunarYear } from "./lunarEntry";

export default function LunarGrid({ selected, onSelect, id }: {
  selected: string; onSelect: (date: string) => void; id: string;
}) {
  const initial = useMemo(() => lunarCursor(selected), [selected]);
  const [yearText, setYearText] = useState(String(initial.year));
  const [month, setMonth] = useState(initial.month);
  const [cursor, setCursor] = useState(initial.day);
  const grid = useRef<HTMLTableElement>(null), keyboardFocus = useRef(false);
  const year = Number(yearText), valid = /^\d{4}$/.test(yearText) && validLunarYear(year);
  const months = useMemo(() => valid ? lunarMonths(year) : [], [valid, year]);
  // A leap month absent in a browsed year falls back to the regular namesake.
  const displayedMonth = months.some(entry => entry.month === month) ? month : Math.abs(month);
  const days = useMemo(() => valid ? lunarDays(year, displayedMonth) : [], [valid, year, displayedMonth]);
  const focused = days.find(day => day.enabled && day.day === cursor) || days.find(day => day.enabled);
  const monthLabel = months.find(entry => entry.month === displayedMonth)?.label || "";
  useEffect(() => {
    if (keyboardFocus.current) {
      grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
      keyboardFocus.current = false;
    }
  }, [cursor, yearText, displayedMonth]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    const row = Math.floor((day - 1) / 6) * 6;
    const targets: Record<string, number> = { ArrowLeft: day - 1, ArrowRight: day + 1,
      ArrowUp: day - 6, ArrowDown: day + 6, Home: row + 1, End: Math.min(row + 6, days.length) };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const target = Math.max(1, Math.min(days.length, targets[event.key]));
    if (days[target - 1]?.enabled) {
      keyboardFocus.current = true;
      setCursor(target);
    }
  }
  return <div className="lunar-entry">
    <DateYearRow value={yearText} onChange={setYearText} helpId={id + "-help"} />
    <p className="date-picker-hint" id={id + "-help"}>
      {valid ? "先选农历月份，再选日期" : "请输入 1901–2099 之间的四位年份"}
    </p>
    <div className="lunar-months" role="group" aria-label="农历月份">
      {months.map(entry => <button key={entry.month} type="button" disabled={!entry.enabled}
        aria-pressed={entry.month === displayedMonth} onClick={() => { setMonth(entry.month); setCursor(1); }}>
        {entry.label}
      </button>)}
    </div>
    <table className="lunar-grid" ref={grid} role="grid"
      aria-label={`农历${valid ? year : ""}年${monthLabel}，选择日期`} aria-describedby={id + "-keyboard"}>
      <tbody>{Array.from({ length: 5 }, (_, row) => <tr key={row}>
        {Array.from({ length: 6 }, (_, col) => {
          const day = days[row * 6 + col];
          return <td key={col} role="gridcell" aria-selected={day?.date === selected}>
            {day && <button type="button" className="lunar-day" disabled={!day.enabled}
              tabIndex={focused?.day === day.day ? 0 : -1}
              aria-label={`农历${year}年${monthLabel}${day.label}，公历${day.date}`}
              data-date={day.date} onFocus={() => setCursor(day.day)}
              onKeyDown={event => navigate(event, day.day)} onClick={() => onSelect(day.date)}>
              {day.label}
            </button>}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
    <p className="sr-only" id={id + "-keyboard"}>
      左右方向键切换一日，上下切换六日，Home 和 End 切换行首行尾，回车确认。
    </p>
  </div>;
}
