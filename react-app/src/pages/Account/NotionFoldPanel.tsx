import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { NotionPanelKey } from "./accountNotionSyncModel";

export interface NotionFoldPanelProps {
  id: NotionPanelKey;
  title: string;
  summary: string;
  icon: ReactNode;
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  open: boolean;
  onToggle: (id: NotionPanelKey) => void;
}

export default function NotionFoldPanel({
  id,
  title,
  summary,
  icon,
  children,
  tone = "default",
  open,
  onToggle
}: NotionFoldPanelProps) {
  return (
    <section className={`notion-fold-panel ${tone} ${open ? "open" : ""}`}>
      <button className="notion-fold-toggle" type="button" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="notion-fold-icon">{icon}</span>
        <span className="notion-fold-title">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <ChevronDown />
      </button>
      {open ? <div className="notion-fold-body">{children}</div> : null}
    </section>
  );
}
