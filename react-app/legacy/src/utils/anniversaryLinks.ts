import type { Anniversary, AnniversaryPlan } from "../types";

type AnniversaryLinkTarget = Pick<Anniversary, "title" | "date">;
type AnniversaryPlanLinkTarget = Pick<AnniversaryPlan, "id" | "personId" | "anniversaryTitle" | "anniversaryDate">;

export function getAnniversaryKey(anniversary: AnniversaryLinkTarget) {
  return `${anniversary.title}|${anniversary.date}`;
}

export function buildPersonAnniversarySuffix(anniversary?: AnniversaryLinkTarget | null) {
  if (!anniversary?.title || !anniversary.date) return "#anniversaries";
  const params = new URLSearchParams({
    anniversary: getAnniversaryKey(anniversary)
  });
  return `?${params.toString()}#anniversaries`;
}

export function buildPersonAnniversaryPath(personId: string, anniversary?: AnniversaryLinkTarget | null) {
  return `/people/${personId}${buildPersonAnniversarySuffix(anniversary)}`;
}

export function buildPlanAnniversaryPath(plan: Pick<AnniversaryPlan, "personId" | "anniversaryTitle" | "anniversaryDate">) {
  return buildPersonAnniversaryPath(plan.personId, {
    title: plan.anniversaryTitle,
    date: plan.anniversaryDate
  });
}

export function buildPlanRecordAnniversaryPath(plan: AnniversaryPlanLinkTarget) {
  const params = new URLSearchParams({
    recordPlan: plan.id,
    anniversary: getAnniversaryKey({
      title: plan.anniversaryTitle,
      date: plan.anniversaryDate
    })
  });
  return `/people/${plan.personId}?${params.toString()}#anniversaries`;
}
