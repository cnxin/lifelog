import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

export interface FloatingAction {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  primary?: boolean;
  onClick: () => void;
}

export default function FloatingActionButton({ actions }: { actions: FloatingAction[] }) {
  const [open, setOpen] = useState(false);
  const primaryAction = actions.find((action) => action.primary) || actions[0];

  useEffect(() => {
    if (!open) return;

    const handleRequestClose = (event: Event) => {
      event.preventDefault();
      setOpen(false);
    };

    window.addEventListener("lifelog:request-close-fab-menu", handleRequestClose);
    return () => window.removeEventListener("lifelog:request-close-fab-menu", handleRequestClose);
  }, [open]);

  if (!actions.length) return null;

  const runAction = (action: FloatingAction) => {
    action.onClick();
    setOpen(false);
  };

  return (
    <div className={`fab-container${open ? " is-open" : ""}`}>
      <button
        className="fab-backdrop"
        aria-hidden={!open}
        aria-label="Close quick actions"
        tabIndex={open ? 0 : -1}
        type="button"
        onClick={() => setOpen(false)}
      />
      <div className="fab-menu" role="menu" aria-label="Quick actions" aria-hidden={!open}>
        {actions.map((action, index) => (
          <button
            type="button"
            role="menuitem"
            className={`pressable${action.primary ? " primary" : ""}`}
            key={action.id}
            style={
              {
                "--fab-index": index,
                "--fab-total": actions.length
              } as CSSProperties
            }
            tabIndex={open ? 0 : -1}
            onClick={() => runAction(action)}
          >
            <span className="fab-menu-label">
              <strong>{action.label}</strong>
              <small>{action.desc}</small>
            </span>
            <span className="fab-menu-icon">{action.icon}</span>
          </button>
        ))}
      </div>
      <button
        className="fab pressable"
        aria-label={open ? "Close quick actions" : primaryAction.label}
        aria-expanded={open}
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="fab-main-icon" aria-hidden="true">
          <Plus />
        </span>
      </button>
    </div>
  );
}
