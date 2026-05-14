import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState({ top: 0, left: 0 });
  const [hourValue, minuteValue] = useMemo(() => parseTimeValue(value), [value]);

  function togglePanel(element: HTMLButtonElement) {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = element.getBoundingClientRect();
    const panelWidth = 136;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.right - panelWidth, viewportPadding),
      window.innerWidth - panelWidth - viewportPadding
    );

    setPanelAnchor({
      top: rect.bottom + 8,
      left
    });
    setIsOpen(true);
  }

  function selectHour(nextHour: string) {
    onChange(`${nextHour}:${minuteValue}`);
  }

  function selectMinute(nextMinute: string) {
    onChange(`${hourValue}:${nextMinute}`);
    setIsOpen(false);
  }

  const panel = isOpen ? (
    <>
      <button
        className="time-picker-backdrop"
        type="button"
        aria-label="关闭时间选择器"
        onClick={() => setIsOpen(false)}
      />
      <div className="time-picker-panel" style={{ top: panelAnchor.top, left: panelAnchor.left }}>
        <div className="time-picker-column" aria-label="小时">
          {hours.map((hour) => (
            <button
              className={hour === hourValue ? "active" : ""}
              type="button"
              key={hour}
              onClick={() => selectHour(hour)}
            >
              {hour}
            </button>
          ))}
        </div>
        <div className="time-picker-column" aria-label="分钟">
          {minutes.map((minute) => (
            <button
              className={minute === minuteValue ? "active" : ""}
              type="button"
              key={minute}
              onClick={() => selectMinute(minute)}
            >
              {minute}
            </button>
          ))}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="time-picker">
      <button
        className="time-picker-trigger"
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={(event) => togglePanel(event.currentTarget)}
      >
        <Clock />
        <span>{hourValue}:{minuteValue}</span>
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function parseTimeValue(value: string) {
  const [rawHour = "09", rawMinute = "00"] = value.split(":");
  const hour = Math.min(Math.max(Number(rawHour), 0), 23);
  const minute = Math.min(Math.max(Number(rawMinute), 0), 59);
  return [String(hour).padStart(2, "0"), String(minute).padStart(2, "0")];
}
