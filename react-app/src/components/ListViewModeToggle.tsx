import { AlignJustify, StretchVertical } from "lucide-react";

interface ListViewModeToggleProps {
  dense: boolean;
  ariaLabel: string;
  onChange: (mode: "compact" | "detailed") => void;
}

export default function ListViewModeToggle({ dense, ariaLabel, onChange }: ListViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label={ariaLabel}>
      <button
        className={dense ? "active" : ""}
        type="button"
        title="紧凑列表"
        aria-label="紧凑列表"
        onClick={() => onChange("compact")}
      >
        <AlignJustify />
      </button>
      <button
        className={!dense ? "active" : ""}
        type="button"
        title="详细列表"
        aria-label="详细列表"
        onClick={() => onChange("detailed")}
      >
        <StretchVertical />
      </button>
    </div>
  );
}
