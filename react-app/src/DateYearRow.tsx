import { ChevronLeft, ChevronRight } from "lucide-react";

/** Shared year input/navigation; typing or browsing never commits a date. */
export default function DateYearRow({ value, onChange, helpId }: {
  value: string; onChange: (year: string) => void; helpId: string;
}) {
  const year = Number(value);
  const valid = /^\d{4}$/.test(value) && year >= 1901 && year <= 2099;
  return <div className="date-year-row">
    <button type="button" className="icon-button" aria-label="上一年"
      disabled={!valid || year <= 1901} onClick={() => onChange(String(year - 1))}>
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
    <label className="date-year-label">年份
      <input type="text" inputMode="numeric" maxLength={4} value={value}
        aria-invalid={!valid} aria-describedby={helpId}
        onChange={event => onChange(event.target.value)} />
    </label>
    <button type="button" className="icon-button" aria-label="下一年"
      disabled={!valid || year >= 2099} onClick={() => onChange(String(year + 1))}>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </div>;
}
