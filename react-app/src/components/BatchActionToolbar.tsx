import type { ReactNode } from "react";
import { CheckSquare, Square, X } from "lucide-react";
import GlassCard from "./GlassCard";

export interface BatchAction {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}

interface BatchActionToolbarProps {
  selectedCount: number;
  itemLabel: string;
  hint: string;
  allSelected: boolean;
  onToggleAll: () => void;
  onClose: () => void;
  actions: BatchAction[];
  className?: string;
}

export default function BatchActionToolbar({
  selectedCount,
  itemLabel,
  hint,
  allSelected,
  onToggleAll,
  onClose,
  actions,
  className = ""
}: BatchActionToolbarProps) {
  return (
    <GlassCard className={`batch-share-toolbar unified-batch-toolbar ${className}`.trim()}>
      <div>
        <strong>已选择 {selectedCount} {itemLabel}</strong>
        <span>{hint}</span>
      </div>
      <div>
        <button className="mini-action" type="button" onClick={onToggleAll}>
          {allSelected ? <Square size={14} /> : <CheckSquare size={14} />}
          {allSelected ? "取消全选" : "全选"}
        </button>
        {actions.map((action) => (
          <button
            className={`mini-action ${action.tone === "danger" ? "danger" : ""}`}
            type="button"
            key={action.id}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
        <button className="mini-action" type="button" aria-label="退出批量管理" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
    </GlassCard>
  );
}
