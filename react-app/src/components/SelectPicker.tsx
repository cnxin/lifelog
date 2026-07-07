import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectPickerOption {
  value: string;
  label: string;
}

interface SelectPickerProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: SelectPickerOption[];
  placeholder?: string;
  label: string;
  onChange?: (value: string) => void;
  required?: boolean;
}

export default function SelectPicker({
  name,
  value,
  defaultValue = "",
  options,
  placeholder = "请选择",
  label,
  onChange,
  required = false
}: SelectPickerProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState({ top: 0, left: 0, width: 156 });
  const selectedValue = isControlled ? value : internalValue;
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === selectedValue)?.label || placeholder,
    [options, placeholder, selectedValue]
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleCloseRequest(event: Event) {
      event.preventDefault();
      setIsOpen(false);
    }
    window.addEventListener("lifelog:request-close-floating-panel", handleCloseRequest);
    return () => window.removeEventListener("lifelog:request-close-floating-panel", handleCloseRequest);
  }, [isOpen]);

  function togglePanel(element: HTMLButtonElement) {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const rect = element.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, 156);
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.right - panelWidth, viewportPadding),
      window.innerWidth - panelWidth - viewportPadding
    );
    setPanelAnchor({ top: rect.bottom + 8, left, width: panelWidth });
    setIsOpen(true);
  }

  function selectValue(nextValue: string) {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setIsOpen(false);
  }

  const panel = isOpen ? (
    <>
      <button className="select-picker-backdrop" type="button" aria-label="关闭选项菜单" onClick={() => setIsOpen(false)} />
      <div className="select-picker-menu" style={{ top: panelAnchor.top, left: panelAnchor.left, width: panelAnchor.width }}>
        {options.map((option) => (
          <button
            className={option.value === selectedValue ? "active" : ""}
            type="button"
            key={option.value}
            onClick={() => selectValue(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  ) : null;

  return (
    <div className="select-picker">
      {name && <input type="hidden" name={name} value={selectedValue || ""} required={required} />}
      <button
        className="select-picker-trigger"
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={(event) => togglePanel(event.currentTarget)}
      >
        <span className={selectedValue ? "" : "placeholder"}>{selectedLabel}</span>
        <ChevronDown />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
