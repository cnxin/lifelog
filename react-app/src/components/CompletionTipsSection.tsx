import { ChevronDown, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface CompletionTip {
  id: string;
  icon: ReactNode;
  title: string;
  desc: string;
  visible: boolean;
}

interface CompletionTipsSectionProps {
  tips: CompletionTip[];
  onAction: () => void;
  actionLabel?: string;
  title?: string;
  collapsedLabel?: string;
  defaultOpen?: boolean;
}

export default function CompletionTipsSection({
  tips,
  onAction,
  actionLabel = "去编辑",
  title = "建议补充",
  collapsedLabel,
  defaultOpen = false,
}: CompletionTipsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const visibleTips = tips.filter((tip) => tip.visible);
  if (visibleTips.length === 0) return null;

  const summaryText = collapsedLabel || `可补充 ${visibleTips.length} 项资料`;

  return (
    <section className="section completion-section">
      <button
        className={`completion-summary-card ${open ? "open" : ""}`}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="completion-summary-icon">
          <Sparkles />
        </span>
        <span className="completion-summary-copy">
          <strong>{title}</strong>
          <small>{summaryText}</small>
        </span>
        <span className="completion-summary-action">
          {open ? "收起" : "查看"}
          <ChevronDown />
        </span>
      </button>
      {open && (
        <div className="completion-list">
          <div className="completion-list-header">
            <span>补充后页面会更完整</span>
            <button className="see-all" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
          {visibleTips.map((tip) => (
            <button className="completion-card" key={tip.id} onClick={onAction}>
              <div className="task-icon">{tip.icon}</div>
              <div>
                <strong>{tip.title}</strong>
                <span>{tip.desc}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
