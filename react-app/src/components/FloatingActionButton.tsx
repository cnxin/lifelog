import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, X } from "lucide-react";

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

  function runAction(action: FloatingAction) {
    setOpen(false);
    action.onClick();
  }

  if (!actions.length) return null;

  return (
    <div className="fab-container">
      {open && (
        <>
          <button className="fab-backdrop" aria-label="关闭快捷新增" onClick={() => setOpen(false)} />
          <div className="fab-menu" role="menu" aria-label="快捷操作">
            {actions.map((action) => (
              <button
                type="button"
                role="menuitem"
                className={action.primary ? "primary" : ""}
                key={action.id}
                onClick={() => runAction(action)}
              >
                <span className="fab-menu-icon">{action.icon}</span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.desc}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button className={`fab ${open ? "open" : ""}`} aria-label={open ? "关闭快捷操作" : primaryAction.label} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? <X /> : <Plus />}
      </button>
    </div>
  );
}
