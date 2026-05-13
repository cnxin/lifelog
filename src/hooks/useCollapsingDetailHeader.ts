import { useEffect, useRef, useState } from "react";

export function useCollapsingDetailHeader(collapseThreshold = 96, expandThreshold = 16) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".main-content");
    if (!scrollRoot) return;

    const updateCollapsed = () => {
      const nextCollapsed = collapsedRef.current
        ? scrollRoot.scrollTop > expandThreshold
        : scrollRoot.scrollTop > collapseThreshold;

      if (nextCollapsed === collapsedRef.current) return;
      collapsedRef.current = nextCollapsed;
      setCollapsed(nextCollapsed);
    };

    updateCollapsed();
    scrollRoot.addEventListener("scroll", updateCollapsed, { passive: true });

    return () => scrollRoot.removeEventListener("scroll", updateCollapsed);
  }, [collapseThreshold, expandThreshold]);

  return collapsed;
}
