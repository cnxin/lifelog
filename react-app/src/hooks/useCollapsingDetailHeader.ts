import { useEffect, useRef, useState } from "react";

export function useCollapsingDetailHeader(collapseThreshold = 60, expandThreshold = 0) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".main-content");
    if (!scrollRoot) return;

    let frameId = 0;
    const updateCollapsed = () => {
      frameId = 0;

      const next = collapsedRef.current
        ? scrollRoot.scrollTop > expandThreshold
        : scrollRoot.scrollTop > collapseThreshold;

      if (next === collapsedRef.current) return;

      collapsedRef.current = next;
      setCollapsed(next);
    };

    const onScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(updateCollapsed);
    };

    updateCollapsed();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [collapseThreshold, expandThreshold]);

  return collapsed;
}
