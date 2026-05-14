import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

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
}

export default function CompletionTipsSection({
  tips,
  onAction,
  actionLabel = "去编辑",
}: CompletionTipsSectionProps) {
  const visibleTips = tips.filter((tip) => tip.visible);
  if (visibleTips.length === 0) return null;

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <Sparkles /> 建议补充
        </h2>
        <button className="see-all" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
      <div className="completion-list">
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
    </section>
  );
}
