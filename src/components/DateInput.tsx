import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface DateInputProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  label: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 131 }, (_, index) => String(currentYear - index));
const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

export default function DateInput({ name, value, defaultValue = "", label, required = false, onChange }: DateInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState({ top: 0, left: 0 });
  const selectedValue = isControlled ? value : internalValue;
  const [yearValue, monthValue, dayValue] = useMemo(() => parseDateValue(selectedValue), [selectedValue]);
  const days = useMemo(() => {
    const count = new Date(Number(yearValue), Number(monthValue), 0).getDate();
    return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [monthValue, yearValue]);

  function togglePanel(element: HTMLButtonElement) {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = element.getBoundingClientRect();
    const panelWidth = 220;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.right - panelWidth, viewportPadding),
      window.innerWidth - panelWidth - viewportPadding
    );
    setPanelAnchor({ top: rect.bottom + 8, left });
    setIsOpen(true);
  }

  function updateDate(nextYear: string, nextMonth: string, nextDay: string, closePanel = false) {
    const maxDay = new Date(Number(nextYear), Number(nextMonth), 0).getDate();
    const normalizedDay = String(Math.min(Number(nextDay), maxDay)).padStart(2, "0");
    const nextValue = `${nextYear}-${nextMonth}-${normalizedDay}`;
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    if (closePanel) setIsOpen(false);
  }

  const panel = isOpen ? (
    <>
      <button className="date-input-backdrop" type="button" aria-label="关闭日期选择器" onClick={() => setIsOpen(false)} />
      <div className="date-input-panel" style={{ top: panelAnchor.top, left: panelAnchor.left }}>
        <div className="date-input-column" aria-label="年份">
          {years.map((year) => (
            <button
              className={year === yearValue ? "active" : ""}
              type="button"
              key={year}
              onClick={() => updateDate(year, monthValue, dayValue)}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="date-input-column" aria-label="月份">
          {months.map((month) => (
            <button
              className={month === monthValue ? "active" : ""}
              type="button"
              key={month}
              onClick={() => updateDate(yearValue, month, dayValue)}
            >
              {month}
            </button>
          ))}
        </div>
        <div className="date-input-column" aria-label="日期">
          {days.map((day) => (
            <button
              className={day === dayValue ? "active" : ""}
              type="button"
              key={day}
              onClick={() => updateDate(yearValue, monthValue, day, true)}
            >
              {day}
            </button>
          ))}
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
        onClick={(event) => togglePanel(event.currentTarget)}
      >
        <CalendarDays />
        <span className={selectedValue ? "" : "placeholder"}>{selectedValue || "选择日期"}</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function parseDateValue(value: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [rawYear, rawMonth, rawDay] = (value || today).split("-");
  const year = years.includes(rawYear) ? rawYear : String(currentYear);
  const month = months.includes(rawMonth) ? rawMonth : "01";
  const maxDay = new Date(Number(year), Number(month), 0).getDate();
  const day = String(Math.min(Math.max(Number(rawDay) || 1, 1), maxDay)).padStart(2, "0");
  return [year, month, day];
}
