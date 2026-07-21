import type { SearchKind } from "./globalSearch";

interface SearchResultRouteState {
  searchResultFocus: {
    kind: SearchKind;
    id: string;
  };
  searchReturn: {
    query: string;
  };
}

export function buildSearchResultRouteState(kind: SearchKind, id: string, query: string): SearchResultRouteState {
  return {
    searchResultFocus: { kind, id },
    searchReturn: { query }
  };
}

export function isSearchResultFocus(state: unknown, kind: SearchKind, id: string) {
  if (!state || typeof state !== "object") return false;
  const focus = (state as { searchResultFocus?: unknown }).searchResultFocus;
  if (!focus || typeof focus !== "object") return false;
  const value = focus as { kind?: unknown; id?: unknown };
  return value.kind === kind && value.id === id;
}

export function getSearchReturnQuery(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const searchReturn = (state as { searchReturn?: unknown }).searchReturn;
  if (!searchReturn || typeof searchReturn !== "object") return null;
  const query = (searchReturn as { query?: unknown }).query;
  return typeof query === "string" ? query : null;
}

export function resumeGlobalSearch(query: string) {
  window.dispatchEvent(new CustomEvent("lifelog:resume-global-search", { detail: { query } }));
  window.dispatchEvent(new Event("lifelog:open-global-search"));
}
