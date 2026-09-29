import { useEffect, useMemo, useState } from "react";
import { recordUxMetric, type OnboardingMetricStep } from "../utils/uxMetrics";

interface OnboardingProgress {
  version: 1;
  audience: "new-user" | "existing-user";
  completed: OnboardingMetricStep[];
  skipped: OnboardingMetricStep[];
}

const STORAGE_KEY = "lifelog:onboarding-progress:v1";
const ALL_STEPS: OnboardingMetricStep[] = ["first-memory", "first-person", "backup-choice"];

export function useOnboardingProgress({
  memoryCount,
  personCount,
  totalRecords
}: {
  memoryCount: number;
  personCount: number;
  totalRecords: number;
}) {
  const [progress, setProgress] = useState<OnboardingProgress>(() => loadProgress(totalRecords));
  const hasBackupChoice = readHasBackupChoice();

  useEffect(() => {
    if (progress.audience !== "new-user") return;
    const newlyCompleted = ALL_STEPS.filter((step) => {
      if (progress.completed.includes(step) || progress.skipped.includes(step)) return false;
      if (step === "first-memory") return memoryCount > 0;
      if (step === "first-person") return personCount > 0;
      return hasBackupChoice;
    });
    if (!newlyCompleted.length) return;

    const next = {
      ...progress,
      completed: [...progress.completed, ...newlyCompleted]
    };
    saveProgress(next);
    setProgress(next);
    for (const step of newlyCompleted) {
      recordUxMetric({ event: "onboarding_step", step, outcome: "complete" });
    }
  }, [hasBackupChoice, memoryCount, personCount, progress]);

  const stepStates = useMemo(() => {
    const done = new Set([...progress.completed, ...progress.skipped]);
    return Object.fromEntries(ALL_STEPS.map((step) => [step, done.has(step)])) as Record<OnboardingMetricStep, boolean>;
  }, [progress.completed, progress.skipped]);

  function skipStep(step: OnboardingMetricStep) {
    if (progress.audience !== "new-user" || stepStates[step]) return;
    const next = { ...progress, skipped: [...progress.skipped, step] };
    saveProgress(next);
    setProgress(next);
    recordUxMetric({ event: "onboarding_step", step, outcome: "skip" });
  }

  return {
    visible: progress.audience === "new-user" && ALL_STEPS.some((step) => !stepStates[step]),
    completedCount: ALL_STEPS.filter((step) => stepStates[step]).length,
    stepStates,
    skipStep
  };
}

function loadProgress(totalRecords: number): OnboardingProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isProgress(parsed)) return parsed;
    }
  } catch {
    // A storage failure must not block the home screen.
  }

  const initial: OnboardingProgress = {
    version: 1,
    audience: totalRecords === 0 ? "new-user" : "existing-user",
    completed: [],
    skipped: []
  };
  saveProgress(initial);
  return initial;
}

function saveProgress(progress: OnboardingProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Onboarding remains usable for the current render without persistence.
  }
}

function readHasBackupChoice() {
  try {
    return Boolean(
      window.localStorage.getItem("lifelog:last-full-backup-at")
      || window.localStorage.getItem("lifelog:last-full-backup-meta")
    );
  } catch {
    return false;
  }
}

function isProgress(value: unknown): value is OnboardingProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnboardingProgress>;
  return candidate.version === 1
    && (candidate.audience === "new-user" || candidate.audience === "existing-user")
    && isStepArray(candidate.completed)
    && isStepArray(candidate.skipped);
}

function isStepArray(value: unknown): value is OnboardingMetricStep[] {
  return Array.isArray(value) && value.every((step) => ALL_STEPS.includes(step));
}
