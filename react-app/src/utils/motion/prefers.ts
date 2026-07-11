/** System motion / transparency preferences */

function hasMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

export function prefersReducedMotion(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function prefersReducedTransparency(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

export function subscribePrefersReducedMotion(callback: (value: boolean) => void): () => void {
  if (!hasMatchMedia()) {
    callback(false);
    return () => undefined;
  }
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => callback(mql.matches);
  handler();
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}
