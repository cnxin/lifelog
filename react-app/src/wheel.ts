export const WHEEL_ROW_HEIGHT = 44;

/** Two blank rows above the list make index * 44 its centered scrollTop. */
export function nearestWheelIndex(scrollTop: number, count: number) {
  const offset = Number.isFinite(scrollTop) ? scrollTop : 0;
  return Math.min(Math.max(0, count - 1), Math.max(0, Math.round(offset / WHEEL_ROW_HEIGHT)));
}

export function wheelKeyIndex(index: number, key: string, count: number): number | null {
  const steps: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
  const last = Math.max(0, count - 1);
  if (key === "Home") return 0;
  if (key === "End") return last;
  if (!(key in steps)) return null;
  return Math.min(last, Math.max(0, index + steps[key]));
}
