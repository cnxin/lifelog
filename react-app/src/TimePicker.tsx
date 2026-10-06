import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { haptic } from "./haptics";

const pad = (value: number) => String(value).padStart(2, "0");

/** Inline, local-time picker. No native time dialog and no second modal. */
export default function TimePicker({ value, onChange, open, onOpenChange, onUseGlobal, disabled = false }: {
  value: string;
  onChange: (time: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseGlobal?: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const [hour, minute] = value.split(":").map(Number);
  const [minuteText, setMinuteText] = useState(pad(minute));
  useEffect(() => setMinuteText(pad(minute)), [minute]);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) trigger.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
      // Scroll only the sheet body, never the document or dialog itself.
      const body = field.current?.closest<HTMLElement>(".modal-body");
      if (body && field.current) body.scrollTo({
        top: body.scrollTop + field.current.getBoundingClientRect().top - body.getBoundingClientRect().top - 8,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  function close() {
    onOpenChange(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function select(nextHour: number, nextMinute: number) {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
    setMinuteText(pad(nextMinute));
    void haptic("light");
  }
  const validMinute = /^(?:[0-5]?\d)$/.test(minuteText);
  return <div className="time-field" ref={field} onKeyDown={event => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button type="button" className="time-trigger" ref={trigger} disabled={disabled}
      aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
      <Clock size={18} aria-hidden="true" />
      <span>提醒时间 <strong>{value}</strong></span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div className="time-picker" id={id} ref={panel} role="region" aria-label="选择提醒时间">
      <div className="time-grid-label">小时</div>
      <div className="time-grid time-hours" role="group" aria-label="小时">
        {Array.from({ length: 24 }, (_, n) => <button type="button" key={n} disabled={disabled}
          aria-label={`${pad(n)}时`} aria-pressed={hour === n} onClick={() => select(n, minute)}>{pad(n)}</button>)}
      </div>
      <div className="time-grid-label">分钟 · 每 5 分钟</div>
      <div className="time-grid" role="group" aria-label="分钟">
        {Array.from({ length: 12 }, (_, n) => n * 5).map(n => <button type="button" key={n} disabled={disabled}
          aria-label={`${pad(n)}分`} aria-pressed={minute === n} onClick={() => select(hour, n)}>{pad(n)}</button>)}
      </div>
      <label className="time-exact" htmlFor={id + "-minute"}>精确到分钟
        <input id={id + "-minute"} type="text" inputMode="numeric" pattern="[0-5]?[0-9]" required
          maxLength={2} value={minuteText} disabled={disabled} aria-invalid={!validMinute}
          aria-describedby={id + "-help"} onChange={event => {
            const raw = event.target.value;
            if (!/^\d{0,2}$/.test(raw)) return;
            setMinuteText(raw);
            if (/^[0-5]?\d$/.test(raw)) onChange(`${pad(hour)}:${pad(Number(raw))}`);
          }} onBlur={() => setMinuteText(pad(minute))} />
      </label>
      <p className="time-help" id={id + "-help"}>{validMinute ? "输入 00–59，可设置任意一分钟" : "请输入 00–59 的分钟"}</p>
      <div className="time-picker-footer">
        {onUseGlobal && <button type="button" className="text-button" disabled={disabled} onClick={() => { onUseGlobal(); close(); }}>用全局时间</button>}
        <button type="button" className="text-button" disabled={disabled} onClick={close}>收起</button>
      </div>
    </div>}
  </div>;
}
