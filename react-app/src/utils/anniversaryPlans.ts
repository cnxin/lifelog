import type { Anniversary, AnniversaryPlan, AnniversaryPlanTargetKind } from "../types";

export interface AnniversaryPlanTarget {
  targetKind: AnniversaryPlanTargetKind;
  occurrenceYear: number;
  targetDate: string;
  daysUntilTarget: number;
  milestoneDay?: number;
  milestoneLabel?: string;
}

export function normalizeAnniversaryPlanTargetKind(plan: Pick<AnniversaryPlan, "targetKind">): AnniversaryPlanTargetKind {
  return plan.targetKind === "milestone" ? "milestone" : "annual";
}

export function buildAnnualPlanTarget(occurrence: { year: number; date: string; days: number }): AnniversaryPlanTarget {
  return {
    targetKind: "annual",
    occurrenceYear: occurrence.year,
    targetDate: occurrence.date,
    daysUntilTarget: occurrence.days
  };
}

export function buildMilestonePlanTarget(milestone: { milestoneDay: number; label: string; date: string; days: number }): AnniversaryPlanTarget {
  return {
    targetKind: "milestone",
    occurrenceYear: Number(milestone.date.slice(0, 4)) || new Date().getFullYear(),
    targetDate: milestone.date,
    daysUntilTarget: milestone.days,
    milestoneDay: milestone.milestoneDay,
    milestoneLabel: milestone.label
  };
}

export function findPlanForAnniversaryTarget(
  plans: AnniversaryPlan[],
  personId: string,
  anniversary: Anniversary,
  target: AnniversaryPlanTarget
) {
  return plans.find((plan) =>
    plan.personId === personId &&
    plan.anniversaryTitle === anniversary.title &&
    plan.anniversaryDate === anniversary.date &&
    matchesPlanTarget(plan, target)
  );
}

export function findAnnualPlanHistory(
  plans: AnniversaryPlan[],
  personId: string,
  anniversary: Anniversary,
  excludeOccurrenceYear: number
) {
  return plans
    .filter((plan) =>
      normalizeAnniversaryPlanTargetKind(plan) === "annual" &&
      plan.personId === personId &&
      plan.anniversaryTitle === anniversary.title &&
      plan.anniversaryDate === anniversary.date &&
      plan.occurrenceYear !== excludeOccurrenceYear
    )
    .sort((left, right) => right.occurrenceYear - left.occurrenceYear);
}

export function formatAnniversaryPlanTargetTitle(plan: Pick<AnniversaryPlan, "anniversaryTitle" | "targetKind" | "milestoneLabel">) {
  return normalizeAnniversaryPlanTargetKind(plan) === "milestone" && plan.milestoneLabel
    ? `${plan.anniversaryTitle}${plan.milestoneLabel}`
    : plan.anniversaryTitle;
}

function matchesPlanTarget(plan: AnniversaryPlan, target: AnniversaryPlanTarget) {
  const kind = normalizeAnniversaryPlanTargetKind(plan);
  if (kind !== target.targetKind) return false;
  if (kind === "annual") return plan.occurrenceYear === target.occurrenceYear;
  return plan.targetDate === target.targetDate && plan.milestoneDay === target.milestoneDay;
}
