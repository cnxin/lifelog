import { Check, ChevronRight, Circle, Clock3, Database, PenLine, UserPlus, X } from "lucide-react";
import type { OnboardingMetricStep } from "../utils/uxMetrics";

interface OnboardingChecklistProps {
  completedCount: number;
  stepStates: Record<OnboardingMetricStep, boolean>;
  onStartMemory: () => void;
  onStartPerson: () => void;
  onOpenBackup: () => void;
  onSkipStep: (step: OnboardingMetricStep) => void;
  onLater: () => void;
}

export default function OnboardingChecklist({
  completedCount,
  stepStates,
  onStartMemory,
  onStartPerson,
  onOpenBackup,
  onSkipStep,
  onLater
}: OnboardingChecklistProps) {
  const steps = [
    {
      id: "first-memory" as const,
      icon: PenLine,
      title: "写下第一件事",
      desc: "先留一句，细节以后再补",
      action: "开始记录",
      onAction: onStartMemory
    },
    {
      id: "first-person" as const,
      icon: UserPlus,
      title: "记住一个重要的人",
      desc: "只填名字也可以完成",
      action: "添加人物",
      onAction: onStartPerson
    },
    {
      id: "backup-choice" as const,
      icon: Database,
      title: "选择一次备份方式",
      desc: "导出本地备份，或明确跳过",
      action: "去数据管理",
      onAction: onOpenBackup
    }
  ];

  return (
    <section className="onboarding-checklist" aria-labelledby="onboarding-title">
      <div className="onboarding-checklist-head">
        <div>
          <span>开始使用</span>
          <h2 id="onboarding-title">三步建立你的 LifeLog</h2>
        </div>
        <button type="button" className="onboarding-later" onClick={onLater} title="稍后再做" aria-label="稍后再做">
          <Clock3 />
        </button>
      </div>
      <div className="onboarding-progress" aria-label={`已完成 ${completedCount} / 3 步`}>
        <span style={{ width: `${(completedCount / 3) * 100}%` }} />
      </div>
      <div className="onboarding-step-list">
        {steps.map((step) => {
          const Icon = step.icon;
          const done = stepStates[step.id];
          return (
            <div className={`onboarding-step ${done ? "done" : ""}`} key={step.id}>
              <span className="onboarding-step-state" aria-hidden="true">{done ? <Check /> : <Circle />}</span>
              <Icon className="onboarding-step-icon" />
              <div className="onboarding-step-copy">
                <strong>{step.title}</strong>
                <span>{done ? "已完成" : step.desc}</span>
              </div>
              {!done && (
                <div className="onboarding-step-actions">
                  <button type="button" className="onboarding-step-skip" onClick={() => onSkipStep(step.id)} title={`跳过${step.title}`} aria-label={`跳过${step.title}`}>
                    <X />
                  </button>
                  <button type="button" className="onboarding-step-action" onClick={step.onAction}>
                    {step.action}
                    <ChevronRight />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
