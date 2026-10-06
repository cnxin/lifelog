import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptic } from "./haptics";
import { nearestWheelIndex, wheelKeyIndex, WHEEL_ROW_HEIGHT } from "./wheel";

type Option = { value: string; label: string };
export default function WheelPicker({ options, value, onChange, ariaLabel, disabled = false }: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const selected = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [index, setIndex] = useState(() => Math.max(0, options.findIndex(option => option.value === value)));
  const latest = useRef({ options, onChange, disabled });
  latest.current = { options, onChange, disabled };
  function commit(next: number) {
    const current = latest.current;
    if (current.disabled || !current.options[next] || selected.current === next) return;
    selected.current = next;
    setIndex(next);
    current.onChange(current.options[next].value);
    void haptic("light");
  }
  useLayoutEffect(() => {
    const next = Math.max(0, options.findIndex(option => option.value === value));
    // Our own controlled update must not interrupt a keyboard smooth scroll.
    if (selected.current === next) return;
    clearTimeout(timer.current);
    selected.current = next;
    setIndex(next);
    scroll.current?.scrollTo({ top: next * WHEEL_ROW_HEIGHT, behavior: "auto" });
  }, [value, options]);
  useEffect(() => {
    const element = scroll.current!;
    const settle = () => {
      clearTimeout(timer.current);
      commit(nearestWheelIndex(element.scrollTop, latest.current.options.length));
    };
    // Also cover WebViews that expose scrollend but miss an interrupted scroll.
    const moving = () => { clearTimeout(timer.current); timer.current = setTimeout(settle, 120); };
    element.addEventListener("scrollend", settle);
    element.addEventListener("scroll", moving, { passive: true });
    return () => {
      clearTimeout(timer.current);
      element.removeEventListener("scrollend", settle);
      element.removeEventListener("scroll", moving);
    };
  }, []);
  return <div className="wheel" role="spinbutton" tabIndex={disabled || !options.length ? -1 : 0}
    aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={Math.max(0, options.length - 1)}
    aria-valuenow={index} aria-valuetext={options[index]?.label ?? ""} aria-disabled={disabled || !options.length || undefined}
    onFocus={event => {
      if (event.target !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
    }}
    onKeyDown={event => {
      if (disabled) return;
      const next = wheelKeyIndex(selected.current, event.key, options.length);
      if (next === null) return;
      event.preventDefault();
      scroll.current?.scrollTo({ top: next * WHEEL_ROW_HEIGHT,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      commit(next);
    }}>
    <div className="wheel-selection" aria-hidden="true" />
    <div className="wheel-scroll" ref={scroll} tabIndex={-1} aria-hidden="true">
      <div className="wheel-spacer" />
      {options.map((option, n) => <div className="wheel-option" key={option.value}
        data-selected={n === index}>{option.label}</div>)}
      <div className="wheel-spacer" />
    </div>
  </div>;
}
