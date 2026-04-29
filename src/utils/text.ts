import type { PreferenceGroup } from "../types";

export function initials(name: string) {
  return name.trim().slice(0, 2) || "?";
}

export function splitList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseGroups(value: FormDataEntryValue | null): PreferenceGroup[] {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [category, rawItems = ""] = line.split(/[:：]/);
      return {
        category: category.trim(),
        items: splitList(rawItems)
      };
    })
    .filter((group) => group.category && group.items.length);
}

export function groupsToText(groups: PreferenceGroup[] = []) {
  return groups.map((group) => `${group.category}：${group.items.join("，")}`).join("\n");
}

export function flattenGroups(groups: PreferenceGroup[] = []) {
  return groups.flatMap((group) => group.items);
}

export function groupSummary(groups: PreferenceGroup[] = [], limit = 4) {
  return flattenGroups(groups).slice(0, limit);
}
