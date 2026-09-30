import { useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function MonthPicker({
  month,
  id,
  onSelect,
}: {
  month: string;
  id: string;
  onSelect: (month: string) => void;
}) {
  const labelId = useId();
  const [yearText, setYearText] = useState(month.slice(0, 4));
  const year = Number(yearText);
  const validYear = /^\d{4}$/.test(yearText) && year >= 1901 && year <= 2099;
  return (
    <div className="date-month-panel" id={id}>
      <div className="date-year-row">
        <button
          type="button"
          className="icon-button"
          aria-label="上一年"
          disabled={!validYear || year <= 1901}
          onClick={() => setYearText(String(year - 1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label className="date-year-label">
          年份
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={yearText}
            aria-invalid={!validYear}
            aria-describedby={`${labelId}-help`}
            onChange={(event) => setYearText(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label="下一年"
          disabled={!validYear || year >= 2099}
          onClick={() => setYearText(String(year + 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="date-picker-hint" id={`${labelId}-help`}>
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
              year === Number(month.slice(0, 4)) &&
              index + 1 === Number(month.slice(5))
            }
            onClick={() =>
              onSelect(`${yearText}-${String(index + 1).padStart(2, "0")}`)
            }
          >
            {index + 1}月
          </button>
        ))}
      </div>
    </div>
  );
}
