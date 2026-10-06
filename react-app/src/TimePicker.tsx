import { useEffect, useId, useRef } from "react";
import { ChevronDown, Clock } from "lucide-react";
import TimeWheel from "./TimeWheel";

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
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) trigger.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const frame = requestAnimationFrame(() => {
      const selected = panel.current?.querySelector<HTMLElement>('[role="spinbutton"]');
      selected?.focus({ preventScroll: true });
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
      <TimeWheel value={value} onChange={onChange} disabled={disabled} />
      <div className="time-picker-footer">
        {onUseGlobal && <button type="button" className="text-button" disabled={disabled} onClick={() => { onUseGlobal(); close(); }}>用全局时间</button>}
        <button type="button" className="text-button" disabled={disabled} onClick={close}>收起</button>
      </div>
    </div>}
  </div>;
}
