import type { PreferenceGroup } from "../types";

export function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  if (/^[\u4e00-\u9fff]+$/.test(trimmed)) {
    return trimmed.length <= 3 ? trimmed : `${trimmed[0]}${trimmed[trimmed.length - 1]}`;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function splitList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[，,、;；\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitLines(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitPreferenceItems(value: string) {
  return value
    .split(/[、;；\n]/)
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
        items: splitPreferenceItems(rawItems)
      };
    })
    .filter((group) => group.category && group.items.length);
}

export function groupsToText(groups: PreferenceGroup[] = []) {
  return groups.map((group) => `${group.category}：${group.items.join("、")}`).join("\n");
}

export function flattenGroups(groups: PreferenceGroup[] = []) {
  return groups.flatMap((group) => group.items);
}

export function groupSummary(groups: PreferenceGroup[] = [], limit = 4) {
  return flattenGroups(groups).slice(0, limit);
}
