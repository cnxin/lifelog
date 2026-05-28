export type DraftFieldMap = Record<string, string[]>;

export function buildDraftFieldMap(fields: Array<{ name: string; value: string }>): DraftFieldMap {
  return fields.reduce<DraftFieldMap>((map, field) => {
    if (!field.name) return map;
    map[field.name] = [...(map[field.name] || []), field.value];
    return map;
  }, {});
}

export function getDraftValue(draftValues: DraftFieldMap | undefined, name: string, fallback = "") {
  if (!draftValues) return fallback;
  return draftValues[name]?.[0] ?? fallback;
}

export function getDraftValues(draftValues: DraftFieldMap | undefined, name: string, fallback: string[] = []) {
  if (!draftValues) return fallback;
  return draftValues[name] ? [...draftValues[name]] : [];
}

export function hasDraftField(draftValues: DraftFieldMap | undefined, name: string) {
  return Boolean(draftValues && Object.prototype.hasOwnProperty.call(draftValues, name));
}

export function getDraftJson<T>(draftValues: DraftFieldMap | undefined, name: string, fallback: T): T {
  if (!draftValues || !hasDraftField(draftValues, name)) return fallback;
  const rawValue = getDraftValue(draftValues, name, "");
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}
