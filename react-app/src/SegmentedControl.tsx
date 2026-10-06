import { useId, type ReactNode } from "react";
import { haptic } from "./haptics";

/** Native radios provide focus, arrow keys and fieldset-disabled behavior. */
export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
  className = "",
  hideLabel = false,
  name,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  description?: string;
  className?: string;
  hideLabel?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <fieldset className={`choice-field ${className}`}>
      <legend className={hideLabel ? "sr-only" : undefined}>{label}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label className="choice-option" key={option.value}>
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={value === option.value}
              aria-describedby={description ? `${id}-help` : undefined}
              onChange={() => {
                void haptic("light");
                onChange(option.value);
              }}
            />
            <span>
              {option.icon}
              <span>{option.label}</span>
            </span>
          </label>
        ))}
      </div>
      {description && (
        <p className="choice-help" id={`${id}-help`}>
          {description}
        </p>
      )}
    </fieldset>
  );
}
