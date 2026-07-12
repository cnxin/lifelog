import type { ReactNode } from "react";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
  compact = false
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""} ${className}`.trim()}>
      {icon ? <div className="empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <h3 className="empty-state-title">{title}</h3>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div className="empty-state-actions">
          {primaryAction ? (
            <button
              type="button"
              className={`empty-state-btn ${primaryAction.primary === false ? "ghost" : "primary"}`}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" className="empty-state-btn ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
