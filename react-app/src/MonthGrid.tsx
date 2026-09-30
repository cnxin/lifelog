import { useMemo, type KeyboardEvent } from "react";
import {
  calendarDateInfo,
  monthCells,
  shiftDate,
  shiftMonth,
} from "./calendar";
import { type Category } from "./domain";
import { tones } from "./dayMeta";

export const calendarKeyboardHelp =
  "方向键切换日期，Home 和 End 切换到周首和周末，Page Up 和 Page Down 切换月份，按住 Shift 切换年份，回车确认，Escape 返回上一层。";
export function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export default function MonthGrid({
  month,
  selected,
  cursor,
  today,
  marks,
  extraLabel,
  onSelect,
  onCursor,
  describedBy,
  slide,
  onSlideEnd,
}: {
  month: string;
  selected: string | null;
  cursor: string;
  today: string;
  marks?: Map<string, Category[]>;
  extraLabel?: (date: string) => string;
  onSelect: (date: string) => void;
  onCursor: (date: string, focus: boolean) => void;
  describedBy: string;
  slide?: "prev" | "next";
  onSlideEnd?: () => void;
}) {
  const cells = useMemo(
    () =>
      monthCells(month).map((date) =>
        date ? { date, info: calendarDateInfo(date) } : null,
      ),
    [month],
  );
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
    onCursor(target(), true);
  }
  return (
    <table
      key={month}
      className="calendar-grid"
      role="grid"
      aria-label={`${Number(month.slice(0, 4))}年${Number(month.slice(5))}月，选择日期`}
      aria-describedby={describedBy}
      data-slide={slide}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onSlideEnd?.();
      }}
    >
      <thead>
        <tr>
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
            <th key={day} scope="col">
              <span aria-label={`星期${day}`}>{day}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }, (_, row) => (
          <tr key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((cell, column) => {
              if (!cell) return <td key={`empty-${column}`} />;
              const { date, info } = cell;
              const festivals = [...info.festivals, info.term]
                .filter(Boolean)
                .join("、");
              const extra = extraLabel?.(date);
              return (
                <td key={date} aria-selected={date === selected}>
                  <button
                    type="button"
                    className="calendar-day"
                    data-date={date}
                    data-selected={date === selected}
                    data-today={date === today}
                    tabIndex={date === cursor ? 0 : -1}
                    aria-current={date === today ? "date" : undefined}
                    aria-label={`${dateLabel(date)}，${info.lunar}${festivals ? `，${festivals}` : ""}${date === today ? "，今天" : ""}${extra ? `，${extra}` : ""}`}
                    onClick={() => onSelect(date)}
                    onKeyDown={(event) => navigate(event, date)}
                  >
                    <span className="calendar-number">
                      {Number(date.slice(8))}
                    </span>
                    <span className="calendar-lunar" data-special={!!festivals}>
                      {info.cellText}
                    </span>
                    {marks && (
                      <span className="calendar-dots" aria-hidden="true">
                        {(marks.get(date) || []).map((category) => (
                          <i key={category} className={tones[category]} />
                        ))}
                      </span>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
