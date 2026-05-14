import { useState } from "react";

type NumberStepperValue = number | "";

interface NumberStepperProps {
  name?: string;
  value?: NumberStepperValue;
  defaultValue?: NumberStepperValue;
  min: number;
  max: number;
  step?: number;
  label: string;
  placeholder?: string;
  onChange?: (value: number) => void;
}

export default function NumberStepper({
  name,
  value,
  defaultValue = "",
  min,
  max,
  step = 1,
  label,
  placeholder = "未设置",
  onChange
}: NumberStepperProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<NumberStepperValue>(() => normalizeValue(defaultValue, min, max, step));
  const currentValue = isControlled ? normalizeValue(value, min, max, step) : internalValue;

  function update(nextValue: number) {
    const clampedValue = normalizeValue(nextValue, min, max, step);
    if (clampedValue === "") return;
    if (!isControlled) setInternalValue(clampedValue);
    onChange?.(clampedValue);
  }

  return (
    <div className="number-stepper" aria-label={label}>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <button type="button" onClick={() => currentValue !== "" && update(currentValue - step)} disabled={currentValue === "" || currentValue <= min}>
        −
      </button>
      <span className={currentValue === "" ? "placeholder" : ""}>{currentValue === "" ? placeholder : currentValue}</span>
      <button type="button" onClick={() => update(currentValue === "" ? min : currentValue + step)} disabled={currentValue !== "" && currentValue >= max}>
        +
      </button>
    </div>
  );
}

function normalizeValue(value: NumberStepperValue | undefined, min: number, max: number, step: number): NumberStepperValue {
  if (value === "" || value === undefined || Number.isNaN(value)) return "";
  const clampedValue = Math.min(Math.max(value, min), max);
  const precision = String(step).split(".")[1]?.length || 0;
  return Number(clampedValue.toFixed(precision));
}
