import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowDownUp, Check } from "lucide-react";
import { haptic } from "./haptics";

const options = [
  { value: "upcoming", label: "临近优先" },
  { value: "date", label: "日期从新到旧" },
];

export default function SortMenu({
  value,
  onChange,
  open,
  onOpenChange,
  triggerRef,
}: {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (open) {
      const index = Math.max(
        0,
        options.findIndex((option) => option.value === value),
      );
      setCursor(index);
      root.current
        ?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
        [index]?.focus();
    } else if (wasOpen.current)
      triggerRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, value, triggerRef]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener("click", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);
  return (
    <div className="sort" ref={root}>
      <button
        ref={triggerRef}
        type="button"
        className="sort-button"
        aria-label="排序方式"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <ArrowDownUp size={17} aria-hidden="true" />
        <span>{value === "date" ? "日期" : "临近"}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="sort-menu"
          id={id}
          aria-label="排序方式"
          onKeyDown={(event) => {
            const targets: Record<string, number> = {
              ArrowDown: (cursor + 1) % options.length,
              ArrowUp: (cursor + options.length - 1) % options.length,
              Home: 0,
              End: options.length - 1,
            };
            if (event.key === "Tab") {
              onOpenChange(false);
              return;
            }
            if (!(event.key in targets)) return;
            event.preventDefault();
            const index = targets[event.key];
            setCursor(index);
            root.current
              ?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
              [index]?.focus();
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={index === cursor ? 0 : -1}
              onFocus={() => setCursor(index)}
              onClick={() => {
                if (value !== option.value) {
                  onChange(option.value);
                  void haptic("light");
                }
                onOpenChange(false);
              }}
            >
              <span className="sort-check" aria-hidden="true">
                {value === option.value && <Check size={17} />}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
