import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SearchKind } from "../utils/globalSearch";
import { isSearchResultFocus } from "../utils/searchNavigation";

export function useSearchResultFocus(kind: SearchKind, id: string) {
  const location = useLocation();
  const targetRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(() => isSearchResultFocus(location.state, kind, id));

  useEffect(() => {
    if (!isSearchResultFocus(location.state, kind, id)) {
      setFocused(false);
      return;
    }

    setFocused(true);
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      targetRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    const timer = window.setTimeout(() => setFocused(false), 2200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [id, kind, location.key, location.state]);

  return {
    focusRef: targetRef,
    focusClassName: focused ? "search-result-focus" : ""
  };
}
