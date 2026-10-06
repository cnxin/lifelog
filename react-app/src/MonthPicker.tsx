import { useId, useState } from "react";
import DateYearRow from "./DateYearRow";

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
      <DateYearRow value={yearText} onChange={setYearText} helpId={`${labelId}-help`} />
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
